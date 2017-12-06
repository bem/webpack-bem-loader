'use strict';

const path = require('path'),
    bn = require('@bem/naming'),
    BemCell = require('@bem/cell'),
    BemEntityName = require('@bem/entity-name'),
    bemFs = require('@bem/fs-scheme'),
    bemImport = require('@bem/import-notation'),
    bemConfig = require('bem-config')(),
    requiredPath = require('required-path'),
    falafel = require('falafel'),
    vow = require('vow'),
    vowFs = require('vow-fs'),
    loaderUtils = require('loader-utils'),
    generators = require('./generators');

module.exports = function(source) {
    this.cacheable && this.cacheable();

    const callback = this.async(),
        options = Object.assign({}, this.options.bemLoader, loaderUtils.getOptions(this)),
        levelsMap = options.levels || bemConfig.levelMapSync(),
        levels = Array.isArray(levelsMap) ? levelsMap : Object.keys(levelsMap),
        techs = options.techs || ['js'],
        langs = options.langs || ['en'],
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
        allPromises = [],
        winPath = path => path.replace(/\\/g, '/'),
        namingOptions = options.naming || 'react',
        bemNaming = bn(namingOptions);

    generators.i18n = require('./generators/i18n').generate(langs);

    const result = falafel(source, { sourceType: 'module' }, node => {
        // match `require('b:button')`
        if(!(
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require' &&
            Object(node.arguments[0]).value
        )) return;

        const existingEntitiesPromises = bemImport.parse(
            node.arguments[0].value,
            // FIXME: we really need this context for parsing import?
            // https://github.com/bem-sdk/bem-fs-scheme/issues/18
            bemNaming.parse(path.basename(this.resourcePath).split('.')[0])
        )
        // expand entities by all provided levels
        .reduce((acc, entity) => {
            levels.forEach(layer => {
                // if entity has tech get extensions for it or exactly it,
                // otherwise expand entities by default extensions
                (entity.tech? techMap[entity.tech] || [entity.tech] : defaultExts).forEach(tech => {
                    acc.push(BemCell.create({ entity, tech, layer }));
                });
            });
            return acc;
        }, [])
        // find path for every entity and check it existance
        .map(bemCell => {
            const localNamingOpts = (levelsMap[bemCell.layer] && levelsMap[bemCell.layer].naming) || namingOptions;
            const fsScheme = (levelsMap[bemCell.layer] && levelsMap[bemCell.layer].scheme) || 'nested';
            const entityPath = path.resolve(bemFs(fsScheme).path(bemCell, localNamingOpts));

            this.addDependency(entityPath);

            return vowFs
                .exists(entityPath)
                .then(exist => {
                    // BemFile
                    return {
                        cell : bemCell,
                        exist,
                        // prepare path for require cause relative returns us string that we couldn't require
                        path : winPath(requiredPath(path.relative(path.dirname(this.resourcePath), entityPath)))
                    };
                });
        });

        existingEntitiesPromises.length && allPromises.push(
            vow
                .all(existingEntitiesPromises)
                .then(bemFiles => {
                    /**
                     * techToFiles:
                     *   js: [entity, entity]
                     *   css: [entity, entity, entity]
                     *   i18n: [entity]
                     */
                    const techToFiles = {},
                        existsEntities = {},
                        errEntities = {};

                    bemFiles.forEach(file => {
                        const tech = file.cell.tech,
                            entity = file.cell.entity,
                            block = entity.block,
                            elem = entity.elem,
                            modName = entity.modName,
                            id = entity.id;

                        if(!file.exist) {
                            // there are no realizations found neither on levels not in techs
                            existsEntities[id] || (existsEntities[id] = false);
                            (errEntities[id] || (errEntities[id] = [])).push(file);
                            return;
                        }

                        (techToFiles[tech] || (techToFiles[tech] = [])).push(file);
                        existsEntities[id] = true;

                        // Add existence for `_mod` if `_mod_val` exists.
                        entity.isSimpleMod() === false &&
                            (existsEntities[BemEntityName.create({ block, elem, modName }).id] = true);
                        // Add existance for elem if __elem_mod exists.
                        entity.elem &&
                            (existsEntities[BemEntityName.create({ block, elem }).id] = true);
                    });

                    Object.keys(existsEntities).forEach(fileId => {
                        // check if entity has no tech to resolve
                        existsEntities[fileId] || errEntities[fileId].forEach(file => {
                            this.emitError(`BEM module not found: ${file.path}`);
                        });
                    });

                    node.update(`(${
                        // Each tech has own generator
                        Object.keys(techToFiles)
                            // js tech is always last
                            .sort(a => extToTech[a] === 'js')
                            .map(tech =>
                                (generators[extToTech[tech] || tech] || generators['*'])(techToFiles[tech])
                            )
                            .join(',\n')
                    })`);
                })
        );
    });

    vow.all(allPromises)
        .then(() => callback(null, result.toString()))
        .catch(callback);
};
