const { stripIndents } = require('common-tags');

const webpack = require('./helpers/compiler');
const getModuleById = require('./helpers/getModuleById');

describe('Loader', () => {
    test('Defaults', async () => {
        const mock = {
            'index.js' : `require('b:button')`,
            'common.blocks/button' : {
                'button.js' : `({ block: 'button' })`,
                'button.css' : `.button { }`
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
        const { source } = getModuleById(stats, 'index.js');

        /* eslint-disable max-len */
        expect(source).toBe(stripIndents`[(
            (require('./common.blocks/button/button.js').default || require('./common.blocks/button/button.js')).applyDecls()
        )][0]`);
        /* eslint-enable max-len */
    });
});
