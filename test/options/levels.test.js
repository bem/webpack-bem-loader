const webpack = require('../helpers/compiler');

describe('Options', () => {
    describe('levels', () => {
        test('common/desktop', async () => {
            const mock = {
                'index.js' : `require('b:button')`,
                'common.blocks' : {
                    'button' : {
                        'button.js' : `({ block: 'button', content: 'common' })`
                    }
                },
                'desktop.blocks' : {
                    'button' : {
                        'button.js' : `({ block: 'button', content: 'desktop' })`
                    }
                }
            };
            const config = {
                loader : {
                    test : /\.js$/,
                    options : {
                        levels : [
                            'common.blocks',
                            'desktop.blocks'
                        ]
                    }
                }
            };

            const { stats } = await webpack('index.js', { config, mock });
            const { source } = stats.toJson().modules[1];

            expect(source).toMatchSnapshot();
        });
    });
});
