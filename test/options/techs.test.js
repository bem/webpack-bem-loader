const webpack = require('../helpers/compiler');

describe('Options', () => {
    describe('techs && techMap', () => {
        test('only ts', async () => {
            const mock = {
                'index.ts' : `require('b:button')`,
                'common.blocks' : {
                    'button' : {
                        'button.ts' : `({ block: 'button' })`
                    }
                },
                'desktop.blocks' : {
                    'button' : {
                        'button.ts' : `({ block: 'button', content: 'desktop' })`
                    }
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

            expect(source).toMatchSnapshot();
        });

        // TODO: issue/
        // They need to work together as one tech
        test.skip('ts & js on different levels', async () => {
            const mock = {
                'index.ts' : `require('b:button')`,
                'common.blocks' : {
                    'button' : {
                        'button.ts' : `({ block: 'button' })`
                    }
                },
                'desktop.blocks' : {
                    'button' : {
                        'button.js' : `({ block: 'button', content: 'I love js' })`
                    }
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
            // expect(source).toMatchSnapshot();
        });

        // TODO: issue/
        // We need to choose one if we have both extensions on one level
        test.skip('ts & js on same levels', async () => {
            const mock = {
                'index.ts' : `require('b:button')`,
                'common.blocks' : {
                    'button' : {
                        'button.ts' : `({ block: 'button' })`,
                        'button.js' : `({ block: 'button', content: 'I love js' })`
                    }
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
            // expect(source).toMatchSnapshot();
        });

        test('js & css', async () => {
            const mock = {
                'index.js' : `require('b:button')`,
                'common.blocks' : {
                    'button' : {
                        'button.js' : `({ block: 'button' })`,
                        'button.css' : `.button { }`
                    }
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

            expect(source).toMatchSnapshot();
        });
    });
});
