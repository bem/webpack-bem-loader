const path = require('path');
const nodeEval = require('node-eval');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const webpack = require('../helpers/compiler');

const getOrder = str => {
    const reg = /order:.?(\d+)/g;
    const res = [];
    let match;
    while(match = reg.exec(str)) {
        res.push(Number(match[1]));
    }
    return res;
};

const checkCycledRequires = bundle => {
    let result = true;
    const webpackModules = [];
    const webpackJsonp = (first, second) => {
        second.forEach(webpackModule => webpackModules.push(webpackModule));
    };
    const webpackRequire = function(moduleIndex, moduleId) {
        // check that modules are not required inside themselves
        moduleIndex === moduleId && (result = false);
        return { applyDecls : () => {} };
    };

    // module.exports for faster executing
    nodeEval(`module.exports = ` + bundle, 'main.bundle.js', { webpackJsonp });

    webpackModules.forEach((webpackModule, moduleIndex) => {
        webpackModule({}, {}, webpackRequire.bind(webpackRequire, moduleIndex));
    });

    return result;
};

const config = {
    rules : [{
        test : /\.js$/,
        use : {
            loader : path.resolve(__dirname, '../..'),
            options : {
                levels : [
                    'common.blocks'
                ],
                // TODO: should be default
                techs : ['js', 'css']
            }
        }
    }, {
        test : /\.css$/,
        use : ExtractTextPlugin.extract({
            use : [{
                loader : 'css-loader'
            }]
        })
    }],
    plugins : new ExtractTextPlugin('_index.css')
};

const jsConfig = {
    rules : [{
        test : /\.js$/,
        use : {
            loader : path.resolve(__dirname, '../..'),
            options : {
                levels : ['common.blocks'],
                techs : ['js']
            }
        }
    }]
};

describe('order', () => {
    test('order of dependent blocks', async () => {
        const mock = {
            'index.js' : `require('b:select')`,
            'common.blocks' : {
                'button' : {
                    'button.css' : `.button { order: 0 }\n`
                },
                'select' : {
                    'select.css' : `.select { order: 1 }\n`,
                    'select.js' : `require('b:button')`
                }
            }
        };

        const { assets } = await webpack('index.js', { config, mock });

        const cssFile = assets['_index.css'];
        expect(getOrder(cssFile)).toEqual([0, 1]);
    });

    test('order of modifiers', async () => {
        const mock = {
            'index.js' : `require('b:button m:theme=normal|action m:size=m')`,
            'common.blocks/button' : {
                'button.css' : `.button { order: 0 }\n`,
                '_theme' : {
                    'button_theme_normal.css' : `.button_theme_normal { order: 1 }\n`,
                    'button_theme_action.css' : `.button_theme_action { order: 2 }\n`
                },
                '_size' : {
                    'button_size_m.css' : `.button_size_m, { order: 3 }\n`
                }
            }
        };
        const { assets } = await webpack('index.js', { config, mock });

        const cssFile = assets['_index.css'];
        expect(getOrder(cssFile)).toEqual([0, 1, 2, 3]);
    });

    test('css: order of modifiers required inside block', async () => {
        const mock = {
            'index.js' : `require('b:button m:theme=action m:size=m')`,
            'common.blocks/button' : {
                'button.css' : `.button { order: 0 }\n`,
                'button.js' : `require('m:theme=normal')`,
                '_theme' : {
                    'button_theme_normal.css' : `.button_theme_normal { order: 1 }\n`,
                    'button_theme_action.css' : `.button_theme_action { order: 2 }\n`
                },
                '_size' : {
                    'button_size_m.css' : `.button_size_m, { order: 3 }\n`
                }
            }
        };
        const { assets } = await webpack('index.js', { config, mock });

        const cssFile = assets['_index.css'];
        expect(getOrder(cssFile)).toEqual([0, 1, 2, 3]);
    });

    test('js: order of modifiers required inside block', async () => {
        const mock = {
            'index.js' : `require('b:button m:theme=action m:size=m')`,
            'common.blocks/button' : {
                'button.js' : `require('m:theme=normal')`,
                '_theme' : {
                    'button_theme_normal.js' : `('_theme' + '_normal')`
                },
                '_size' : {
                    'button_size_m.js' : `('_theme' + '_size')`
                }
            }
        };
        const { assets } = await webpack('index.js', { config : jsConfig, mock });

        const jsFile = assets['main.bundle.js'];
        expect(checkCycledRequires(jsFile)).toBe(true);
    });

    test('js: order no conflicts inside gemini.bemjson.js', async () => {
        const mock = {
            'gemini.bemjson.js' : `require('b:gemini')`,
            'common.blocks/gemini' : {
                'gemini.js' : `(1 + 1)`
            }
        };
        const { assets } = await webpack('gemini.bemjson.js', { config : jsConfig, mock });

        const jsFile = assets['main.bundle.js'];
        expect(checkCycledRequires(jsFile)).toBe(true);
    });
});
