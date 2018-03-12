const webpack = require('../helpers/compiler');
const { stripIndents } = require('common-tags');

describe('Options', () => {
    describe('techs && techMap', () => {
        test('only ts', async () => {
            const mock = {
                'index.ts' : `require('b:button')`,
                'common.blocks/button' : {
                    'button.ts' : `({ block: 'button' })`
                },
                'desktop.blocks/button' : {
                    'button.ts' : `({ block: 'button', content: 'desktop' })`
                }
            };
            const config = {
                loader : {
                    test : /\.ts$/,
                    options : {
                        levels : ['common.blocks', 'desktop.blocks'],
                        // this is default
                        techs : ['js'],
                        techMap : {
                            // to work with bem-react-core
                            // we need to map js to ts
                            js : ['ts']
                        }
                    }
                }
            };

            const { stats } = await webpack('index.ts', { config, mock });
            const { source } = stats.toJson().modules[1];

            /* eslint-disable max-len */
            expect(source).toBe(stripIndents`[(
                require('./common.blocks/button/button.ts'),
                (require('./desktop.blocks/button/button.ts').default || require('./desktop.blocks/button/button.ts')).applyDecls()
            )][0]`);
            /* eslint-enable max-len */
        });

        // TODO: https://github.com/bem/webpack-bem-loader/issues/67
        // They need to work together as one tech
        test.skip('ts & js on different levels', async () => {
            const mock = {
                'index.ts' : `require('b:button')`,
                'common.blocks/button' : {
                    'button.ts' : `({ block: 'button' })`
                },
                'desktop.blocks/button' : {
                    'button.js' : `({ block: 'button', content: 'I love js' })`
                }
            };
            const config = {
                loader : {
                    test : [/\.ts$/ , /\.js$/],
                    options : {
                        levels : [
                            'common.blocks',
                            'desktop.blocks'
                        ],
                        techMap : {
                            js : ['ts', 'js']
                        }
                    }
                }
            };

            const { stats } = await webpack('index.ts', { config, mock });
            const { source } = stats.toJson().modules[2];

            console.log(source);
        });

        // TODO: https://github.com/bem/webpack-bem-loader/issues/68
        // We need to choose one if we have both extensions on one level
        test.skip('ts & js on same levels', async () => {
            const mock = {
                'index.ts' : `require('b:button')`,
                'common.blocks/button' : {
                    'button.ts' : `({ block: 'button' })`,
                    'button.js' : `({ block: 'button', content: 'I love js' })`
                }
            };
            const config = {
                loader : {
                    test : [/\.ts$/ , /\.js$/],
                    options : {
                        levels : ['common.blocks'],
                        techMap : {
                            js : ['ts', 'js']
                        }
                    }
                }
            };

            const { stats } = await webpack('index.ts', { config, mock });
            const { source } = stats.toJson().modules[2];

            console.log(source);
        });

        test('js & css', async () => {
            const mock = {
                'index.js' : `require('b:button')`,
                'common.blocks/button' : {
                    'button.js' : `({ block: 'button' })`,
                    'button.css' : `.button { }`
                }
            };
            const config = {
                loader : {
                    test : /\.js$/,
                    options : {
                        levels : [
                            'common.blocks'
                        ],
                        // TODO: should be default
                        techs : ['js', 'css']
                    }
                }
            };

            const { stats } = await webpack('index.js', { config, mock });
            const { source } = stats.toJson().modules[1];

            /* eslint-disable max-len */
            expect(source).toBe(stripIndents`[(
                (require('./common.blocks/button/button.js').default || require('./common.blocks/button/button.js')).applyDecls()
                ),require('./common.blocks/button/button.css')][0]
            `);
            /* eslint-enable max-len */
        });
    });
});
