const webpack = require('./helpers/compiler');

describe('Parser', () => {
    test('dynamic import()', async () => {
        const mock = {
            'index.js' : `const test = import('./module.js')`,
            'module.js' : 'export default null'
        };
        const config = {
            loader : {
                options : {
                    levels : []
                }
            }
        };

        const { stats } = await webpack('index.js', { config, mock });
        const { source } = stats.toJson().modules[0];

        expect(source).toBe(mock['index.js']);
    });
});
