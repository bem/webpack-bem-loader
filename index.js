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
        langs = options['i18n'],
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
                const existingEntitiesPromises = bemImport.parse(
                    node.arguments[0].value,
                    bemNaming.parse(path.basename(this.resourcePath).split('.')[0])
                )

                // expand entities by all provided levels
                .reduce((set, entity, i, arr) => {
                    levels.forEach(layer => {
                        // if entity has tech get exactly it,
                        // otherwise expand entities by default techs
                        [].concat(entity.tech || defaultTechs).forEach(tech => {
                            const cell = new BemCell({entity: new BemEntityName(entity), tech, layer})
                            // only uniq cells
                            set[cell.id] = cell;
                        });
                    });
                    if (arr.length - 1 === i) {
                        // TODO move up before parseEntityImport
                        return Object.keys(set).map(id => set[id]);
                    }
                    return set;
                }, {})

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

                            // Each tech has own transformer
                            // transformer could has read-only access to Node
                            const value = Object.keys(techMap).map(tech => {
                                const files = techMap[tech];

                                switch (tech) {
                                    case 'js':
                                        return stringifyApplyable(files);
                                    case 'i18n':
                                        return stringifyI18n(langs, files);
                                    default:
                                        return bemImport.stringify(files);
                                }
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

/**
 * @property {EsprimaASTNode} node
 * @property {BemFile[]} files
 * @returns {String}
 */
function stringifyApplyable(files) {
    const apply = require => `${require}.default ?
        ${require}.default.applyDecls() :
        ${require}.applyDecls()`;

    const reqStr = file => {
        return `require('${file.path}')`;
    };

    return files
        .reduce((acc, file, i) => {
            return acc.concat(
                i === files.length - 1
                ? `\treturn ${apply(reqStr(file))};`
                : `\t${reqStr(file)};`
            )
        }, ['(function() {'])
        .concat('})()')
        .join('\n');
}

function stringifyI18n(langs, files) {

    console.assert(langs, "Choose languages for i18n");

    const strLang = (file, lang) => `
        var __${lang} = require('${path.resolve(file.path, lang)}');
        // TODO: naming inside keysets
        var _${lang} = Object.keys(__${lang})[0];
        core.decl(_${lang}, __${lang}[_${lang}], {lang: '${lang}'});
    `;

    return files
        .reduce((acc, file) => {
            return acc.concat(langs.map(lang => strLang(file, lang)));
        }, ['(function() {\n\tvar core = require(\'bem-react-i18n-core\');'])
        .concat('\treturn core;\n})()')
        .join('\n');
}
