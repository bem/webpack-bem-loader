const webpack = require('../helpers/compiler');

describe('Options', () => {
    describe('levels', () => {
        test('common/desktop', async () => {
            const mock = {
                'index.js' : `const a = [require('b:Block1 m:mod1=val1'), require('b:Block1 e:Elem1 m:mod1=val1')]`,
                'react-naming.blocks/Block1' : {
                    'Block1.js' : `require('b:block2');`,
                    'Elem1' : {
                        'Elem1.js' : `require('b:block2 e:elem2');`,
                        '_mod1' : {
                            'Block1-Elem1_mod1_val1.js' : `require('b:block2 e:elem2 m:mod2=val2');`
                        }
                    },
                    '_mod1' : {
                        'Block1_mod1_val1.js' : `require('b:block2 m:mod2=val2');`
                    }
                },
                'origin-naming.blocks/block2' : {
                    'block2.js' : `({ block: 'block2' })`,
                    '__elem2' : {
                        'elem2.js' : `({ block: 'block2', elem: 'elem2' })`,
                        '_mod2' : {
                            'block2__elem2_mod2_val2.js' : `({ block: 'block2', elem: 'elem2', mod2: 'val2' })`
                        }
                    },
                    '_mod2' : {
                        'block2_mod2_val2.js' : `({ block: 'block2', mod2: 'val2' })`
                    }
                }
            };
            const config = {
                loader : {
                    test : /\.js$/,
                    options : {
                        levels : {
                            'react-naming.blocks' : {
                                naming : 'react'
                            },
                            'origin-naming.blocks' : {
                                naming : 'origin'
                            }
                        }
                    }
                }
            };

            const { assets, stats } = await webpack('index.js', { config, mock });
            // const { source } = stats.toJson().modules[1];

            // console.log(source);
            // console.log(stats.toJson());
            const jsFile = assets['main.bundle.js'];

            console.log(jsFile);
            console.log(stats.toJson());
            expect(stats.toJson().errors).toHaveLength(0);

        });
    });
});
