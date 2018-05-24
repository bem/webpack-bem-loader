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
    loaderUtils = require('loader-utils'),
    getGenerators = require('./generators');

module.exports = function(source, inputSourceMap) {
    this.cacheable && this.cacheable();

    const callback = this.async(),
        optionsFromCompiler = this.options && this.options.bemLoader,
        options = Object.assign({}, optionsFromCompiler, loaderUtils.getOptions(this)),
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
        unifyPath = path => path.replace(/\\/g, '/'),
        namingOptions = options.naming || 'react',
        bemNaming = bn(namingOptions),
        // https://github.com/bem-sdk/bem-fs-scheme/issues/18
        currentEntityName = path.basename(this.resourcePath),
        currentEntity = bemNaming.parse(currentEntityName.split('.')[0]),
        currentEntityTech = extToTech[currentEntityName.substr(currentEntityName.indexOf('.') + 1)],
        generators = getGenerators(options.generators);

    generators.i18n = require('./generators/i18n').generate(langs);

    const result = falafel(source, { ecmaVersion : 8, sourceType : 'module' }, node => {
        // match `require('b:button')`
        if(!(
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require' &&
            Object(node.arguments[0]).value
        )) return;

        const existingEntitiesPromises = bemImport.parse(
            node.arguments[0].value,
            currentEntity
        )
        // expand entities by all provided levels/techs
        .reduce((acc, entity) => {
            // if entity has tech get extensions for it or exactly it,
            // otherwise expand entities by default extensions
            (entity.tech? techMap[entity.tech] || [entity.tech] : defaultExts).forEach(tech => {
                // don't push js block in context of block itself
                // so we forewarn cycled requires
                // example ``` block.react.js:  import 'm:autoclosable=yes' ```
                if(!(
                    currentEntity.isEqual(BemEntityName.create(entity)) &&
                    currentEntityTech === 'js' &&
                    extToTech[tech] === 'js'
                )) {
                    levels.forEach(layer => {
                        acc.push(BemCell.create({ entity, tech, layer }));
                    });
                }
            });
            return acc;
        }, [])
        // find path for every entity and check it existance
        .map(bemCell => {
            const localNamingOpts = (levelsMap[bemCell.layer] && levelsMap[bemCell.layer].naming) || namingOptions;
            const fsScheme = (levelsMap[bemCell.layer] && levelsMap[bemCell.layer].scheme) || 'nested';
            const entityPath = path.resolve(bemFs(fsScheme).path(bemCell, localNamingOpts));

            this.addDependency(entityPath);

            return new Promise(resolve => this.fs.stat(entityPath, err => {
                // BemFile
                resolve({
                    cell : bemCell,
                    exist : !err,
                    // prepare path for require cause relative returns us string that we couldn't require
                    path : unifyPath(requiredPath(path.relative(path.dirname(this.resourcePath), entityPath)))
                });
            }));
        });

        existingEntitiesPromises.length && allPromises.push(
            Promise
                .all(existingEntitiesPromises)
                .then(bemFiles => {
                    /**
                     * extToFiles:
                     *   js: [entity, entity]
                     *   css: [entity, entity, entity]
                     *   i18n: [entity]
                     */
                    const extToFiles = {},
                        existsEntities = {},
                        errEntities = {};

                    bemFiles.forEach(file => {
                        const ext = file.cell.tech,
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

                        (extToFiles[ext] || (extToFiles[ext] = [])).push(file);
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

                    // Each tech has own generator
                    const res = Object.keys(extToFiles)
                        // use techs from config for order
                        // so the first one would be default, `js` in most cases
                        .sort((a, b) => techs.indexOf(extToTech[a]) - techs.indexOf(extToTech[b]))
                        .map((ext) => {
                            const tech = extToTech[ext] || ext;
                            return `${(generators[tech] || generators['*'])(extToFiles[ext])}`;
                        });

                    node.update(`[${res.join(',')}][0]`);
                })
        );
    });

    Promise.all(allPromises)
        .then(() => callback(null, result.toString(), inputSourceMap))
        .catch(callback);
};
