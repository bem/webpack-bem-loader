'use strict';

const path = require('path'),
    bn = require('bem-naming'),
    BemCell = require('@bem/cell'),
    BemEntityName = require('@bem/entity-name'),
    bemFs = require('bem-fs-scheme')(),
    defaultNaming = {
        elem: '-',
        wordPattern: '[a-zA-Z0-9]+',
        elemDirDelim: ''
    },
    falafel = require('falafel'),
    vow = require('vow'),
    vowFs = require('vow-fs'),
    isFileJsModule = file => path.extname(file) === '.js';

module.exports = function(source) {
    this.cacheable && this.cacheable();

    const callback = this.async(),
        options = this.options.bemLoader,
        levels = options.levels,
        techs = options.techs,
        allPromises = [],
        namingOptions = Object.assign(defaultNaming, options.naming),
        bemNaming = bn(namingOptions),
        result = falafel(source, node => {
            if(
                node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments[0] && node.arguments[0].value &&
                node.arguments[0].value.match(/^(b|e|m)\:/)
            ) {
                let requireIdx = null;

                const currentEntityRequires = parseEntityImport(
                    node.arguments[0].value,
                    bemNaming.parse(path.basename(this.resourcePath).split('.')[0]))
                        .map(entity => {
                            // collect fs path to each entity
                            // if entity has tech get exactly it, otherwise use default techs
                            const entityFiles = [].concat(entity.tech || techs).reduce((acc, tech) =>
                                acc.concat(
                                    // collect entites on all provided levels
                                    levels.map(layer => {
                                        const cell = new BemCell({entity: new BemEntityName(entity), tech, layer})
                                        return path.resolve(process.cwd(), bemFs.path(cell, {
                                            naming: namingOptions,
                                            elemDirDelim: namingOptions.elemDirDelim,
                                            modDirDelim: namingOptions.modDirDelim
                                        }));
                                    })
                                )
                            , []);

                            entityFiles.forEach(this.addDependency, this);

                            return vow.all(entityFiles.map(vowFs.exists))
                                .then(fileExistsRes => {
                                    const requires = entityFiles
                                        .filter((_, i) => fileExistsRes[i])
                                        .map((entityFile, i) => {
                                            !Object(entity.mod).name && isFileJsModule(entityFile) && (requireIdx = i);
                                            return `require('${entityFile}')`
                                        });

                                    return { entity, requires };
                                });
                        });

                allPromises.push(vow.all(currentEntityRequires)
                    .then(currentEntityRequires => {
                        const requires = currentEntityRequires.reduce((res, entity) => {
                            if(!entity.requires.length) {
                                throw new Error(`No BEM entity: "${bemNaming.stringify(entity.entity)}"`);
                            }

                            return res.concat(entity.requires);
                        }, []);


                        const idx = requireIdx !== null,
                            n = `[${requires.join(',')}]${idx? `[${requireIdx}]` : ''}`;

                        node.update(idx? `
                          (${n}.default?
                              ${n}.default.applyDecls() :
                              ${n}.applyDecls())
                          ` : n);
                    }));
            }
        });

    vow.all(allPromises)
        .then(() => {
            callback(null, result.toString());
        })
        .catch(callback);
};

function parseEntityImport(entityImport, ctx) {
    const res = [],
        tech = ~entityImport.indexOf('.')
            ? entityImport.substr(entityImport.indexOf('.') + 1, entityImport.length)
            : null,
        main = {};

        tech && (main.tech = tech);

    entityImport.split(' ').forEach((importToken, i) => {
        const split = importToken.split(':'),
            type = split[0],
            tail = split[1];

        if(!i) {
            main.block = type === 'b'? tail : ctx.block;
            type === 'e' && (main.elem = tail);
        } else if(type === 'e') {
            main.elem = tail;
        }

        switch(type) {
            case 'b':
            case 'e':
                res.length || res.push(main);
            break;

            case 'm':
                const splitMod = tail.split('='),
                    modName = splitMod[0],
                    modVals = splitMod[1];

                if(main.block === ctx.block) {
                    main.elem || (main.elem = ctx.elem);
                }

                if(modVals) {
                    modVals.split('|').forEach(modVal => {
                        res.push(Object.assign({}, main, {mod: {name: modName, val: modVal}}));
                    });
                } else {
                    res.push(Object.assign({}, main, {mod: {name: modName}}));
                }
            break;
        }
    });

    return res;
}
