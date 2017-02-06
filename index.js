'use strict';

const path = require('path'),
    bn = require('@bem/naming'),
    BemCell = require('@bem/cell'),
    BemEntityName = require('@bem/entity-name'),
    bemFs = require('@bem/fs-scheme')(),
    bemImport = require('bem-import'),
    falafel = require('falafel'),
    vow = require('vow'),
    vowFs = require('vow-fs'),
    loaderUtils = require('loader-utils');

module.exports = function(source) {
    this.cacheable && this.cacheable();

    const callback = this.async(),
        options = this.options.bemLoader || loaderUtils.parseQuery(this.query),
        levels = options.levels,
        defaultTechs = options.techs || ['js'],
        generators = Object.assign(require('./generators'), options.customGenerators),
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
                node.arguments[0].value.match(bemImport.matchRegExp)
            ) {
                const existingEntitiesPromises = bemImport.parse(
                    node.arguments[0].value,
                    bemNaming.parse(path.basename(this.resourcePath).split('.')[0])
                )

                // expand entities by all provided levels
                .reduce((acc, entity) => {
                    levels.forEach(layer => {
                        // if entity has tech get exactly it,
                        // otherwise expand entities by default techs
                        [].concat(entity.tech || defaultTechs).forEach(tech => {
                            const cell = new BemCell({entity: new BemEntityName(entity), tech, layer});
                            acc.push(cell);
                        });
                    });
                    return acc;
                }, [])

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
                                path: entityPath
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
                                    techMap[file.cell.tech] = (techMap[file.cell.tech] || []).concat(file);
                                } else {
                                    possibleErrors[file.cell.entity.id] = (possibleErrors[file.cell.entity.id] || [])
                                        .concat(file);
                                }
                                return techMap;
                            }, {});

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

                            // Each tech has own generator
                            const value = Object.keys(techMap).map(tech => {
                                return generators[tech]?
                                    generators[tech](techMap[tech]) :
                                    generators['*'](techMap[tech]);
                            }).join('\n')

                            node.update(value);
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
