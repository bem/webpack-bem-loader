'use strict';

const path = require('path'),
    bn = require('@bem/naming'),
    BemCell = require('@bem/cell'),
    BemEntityName = require('@bem/entity-name'),
    bemFs = require('@bem/fs-scheme')(),
    parseEntityImport = require('./parseImport'),
    falafel = require('falafel'),
    vow = require('vow'),
    vowFs = require('vow-fs'),
    loaderUtils = require('loader-utils'),
    isFileJsModule = file => path.extname(file) === '.js';

module.exports = function(source) {
    this.cacheable && this.cacheable();

    const callback = this.async(),
        options = this.options.bemLoader || loaderUtils.parseQuery(this.query),
        levels = options.levels,
        defaultTechs = options.techs || ['js'],
        applicableTech = defaultTechs[0],
        allPromises = [],
        namingOptions = options.naming || 'react',
        bemNaming = bn(namingOptions),
        result = falafel(source, node => {
            // match by `require('b:button')`
            if(
                node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments[0] && node.arguments[0].value &&
                node.arguments[0].value.match(/^(b|e|m)\:/)
            ) {
                const existingEntitiesPromises = parseEntityImport(
                    node.arguments[0].value,
                    bemNaming.parse(path.basename(this.resourcePath).split('.')[0])
                )

                // expand entities by all provided levels
                .reduce((acc, entity) =>
                    levels.reduce((ac, layer) =>
                        // if entity has tech get exactly it,
                        // otherwise expand entities by default techs
                        ac.concat((entity.tech || defaultTechs).map(tech =>
                            new BemCell({entity: new BemEntityName(entity), tech, layer})
                        ))
                    , acc)
                , [])

                // find path for every entity and check it existance
                .map(bemCell => {
                    const entityPath = path.resolve(
                            process.cwd(),
                            bemFs.path(bemCell, namingOptions)
                        );

                    this.addDependency(entityPath);

                    return vowFs
                        .exists(entityPath)
                        .then(exist => {
                            // BemFile
                            return {
                                cell: bemCell,
                                exist,
                                path: entityPath,
                                type: bemCell.entity.type,
                                tech: bemCell.tech
                            };
                        });
                });

                allPromises.push(
                    vow
                        .all(existingEntitiesPromises)
                        .then(bemFiles => {
                            const possibleErrors = {};
                            /**
                             * techMap:
                             *   js: [enity, entity]
                             *   css: [entity, entity, entity]
                             *   i18n: [entity]
                             */
                            const techMap = bemFiles.reduce((techMap, file) => {
                                if (file.exist) {
                                    techMap[file.tech] = (techMap[file.tech] || []).concat(file);
                                } else {
                                    possibleErrors[file.cell.entity.id] = (possibleErrors[file.cell.entity.id] || [])
                                        .concat(file);
                                }
                                return techMap;
                            }, {});

                            // Each tech has own transformer
                            // transformer could has read-only access to Node
                            const value = Object.keys(techMap).map(tech => {
                                const files = techMap[tech];

                                if (tech === applicableTech) {
                                    return getStrForApplicable(node, files);
                                }

                                return getStrForSimpleRequired(node, files);
                            }).join('\n')

                            Object.keys(possibleErrors).forEach(fileId => {
                                // check if entity has no tech to resolve
                                if (possibleErrors[fileId].length === defaultTechs.length) {
                                    const messages = [];
                                    if (
                                        possibleErrors[fileId]
                                            .every(file => {
                                                messages.push(`BEM-Module not found: ${file.path}`);
                                                return ~defaultTechs.indexOf(file.cell.tech);
                                            })
                                    ) {
                                        messages.map(this.emitError, this);
                                    }
                                }
                            });

                            node.parent.parent.update(value);
                        })
                );
            }
    });

    vow.all(allPromises)
        .then(() => {
            callback(null, result.toString());
        })
        .catch(callback);
};

function getStrForSimpleRequired(node, files) {
    return files
        .map(file => `require('${file.path}');`)
        .join('\n');
}

function getStrForApplicable(node, files) {
    const name = node.parent.id.name;
    return files
        .reduce((acc, file) => {
            if (file.type === 'block' || file.type === 'elem') {
                acc[0].push(`var ${name} = require('${file.path}');`);
                acc[2].push(`${name} = ${name}.default ? ${name}.default.applyDecls() : ${name}.applyDecls();`);
            } else {
                acc[1].push(`require('${file.path}');`);
            }
            return acc;
        }, [[],[],[]])
        .reduce((acc, arr) => acc.concat(arr), [])
        .join('\n');
}
