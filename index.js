'use strict';

const path = require('path'),
    bn = require('@bem/naming'),
    BemCell = require('@bem/cell'),
    bemFs = require('@bem/fs-scheme')(),
    bemImport = require('@bem/import-notation'),
    falafel = require('falafel'),
    vow = require('vow'),
    vowFs = require('vow-fs'),
    loaderUtils = require('loader-utils');

module.exports = function(source) {
    this.cacheable && this.cacheable();

    const callback = this.async(),
        options = this.options.bemLoader || loaderUtils.parseQuery(this.query),
        levels = options.levels,
        techs = options.techs || ['js'],
        techMap = techs.reduce((acc, tech) => {
            acc[tech] || (acc[tech] = [tech]);
            return acc;
        }, options.techMap || {}),
        extToTech = Object.keys(techMap).reduce((acc, tech) => {
            techMap[tech].forEach(ext => {
                acc[ext] = tech;
            });
            return acc;
        }, {}),
        defaultExts = Object.keys(extToTech),
        generators = require('./generators'),
        allPromises = [],
        namingOptions = options.naming || 'react',
        bemNaming = bn(namingOptions),
        result = falafel(source, node => {
            // match `require('b:button')`
            if(
                node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments[0] && node.arguments[0].value
            ) {
                const existingEntitiesPromises = bemImport.parse(
                    node.arguments[0].value,
                    bemNaming.parse(path.basename(this.resourcePath).split('.')[0])
                )

                // expand entities by all provided levels
                .reduce((acc, entity) => {
                    levels.forEach(layer => {
                        // if entity has tech get extensions for it or exactly it,
                        // otherwise expand entities by default extensions
                        (
                            entity.tech ?
                                techMap[entity.tech] || [entity.tech] :
                                defaultExts
                        ).forEach(tech => {
                            acc.push(BemCell.create({entity, tech, layer}));
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

                existingEntitiesPromises.length && allPromises.push(
                    vow
                        .all(existingEntitiesPromises)
                        .then(bemFiles => {
                            const techToFiles = {};
                            const existsEntities = {};
                            const unExistsEntities = {};
                            const uniqEntities = {};
                            /**
                             * techToFiles:
                             *   js: [enity, entity]
                             *   css: [entity, entity, entity]
                             *   i18n: [entity]
                             */
                            bemFiles.forEach(file => {
                                existsEntities[file.cell.entity.id] || (existsEntities[file.cell.entity.id] = []);
                                unExistsEntities[file.cell.entity.id] || (unExistsEntities[file.cell.entity.id] = []);
                                uniqEntities[file.cell.entity.id] = file.cell.entity;
                                if (file.exist) {
                                    (techToFiles[file.cell.tech] || (techToFiles[file.cell.tech] = [])).push(file);
                                    existsEntities[file.cell.entity.id].push(file);
                                } else {
                                    unExistsEntities[file.cell.entity.id].push(file);
                                }
                            });

                            Object.keys(existsEntities).forEach(fileId => {
                                // check if entity has no tech to resolve
                                if (!existsEntities[fileId].length) {
                                    const entity = uniqEntities[fileId];
                                    if (entity.isSimpleMod()) {
                                        return;
                                    }
                                    unExistsEntities[fileId].forEach(file => {
                                        this.emitError(`BEM-Module not found: ${file.path}`);
                                    });
                                }
                            });

                            // Each tech has own generator
                            const value = Object.keys(techToFiles).map(tech =>
                                (generators[extToTech[tech] || tech] || generators['*'])(techToFiles[tech])
                            ).join('\n')

                            node.update(value);
                        })
                );
            }
    });

    vow.all(allPromises)
        .then(() => callback(null, result.toString()))
        .catch(callback);
};
