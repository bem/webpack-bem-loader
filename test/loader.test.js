const webpack = require('./helpers/compiler');

describe('Loader', () => {
    test('Defaults', async () => {
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
                options : {
                    // Required option
                    levels : ['common.blocks']
                }
            }
        };

        const { stats } = await webpack('index.js', { config, mock });
        const { source } = stats.toJson().modules[1];

        expect(source).toMatchSnapshot();
    });
});
