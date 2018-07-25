const { stripIndents } = require('common-tags');

const webpack = require('../helpers/compiler');
const getModuleById = require('../helpers/getModuleById');

describe('Options', () => {
    describe('levels', () => {
        test('common/desktop', async () => {
            const mock = {
                'index.js' : `require('b:button')`,
                'common.blocks/button' : {
                    'button.js' : `({ block: 'button', content: 'common' })`
                },
                'desktop.blocks/button' : {
                    'button.js' : `({ block: 'button', content: 'desktop' })`
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
            // const { source } = stats.toJson().modules[1];
            const { source } = getModuleById(stats, 'index.js');

            /* eslint-disable max-len */
            expect(source).toBe(stripIndents`[(
                require('./common.blocks/button/button.js'),
                (require('./desktop.blocks/button/button.js').default || require('./desktop.blocks/button/button.js')).applyDecls()
            )][0]`);
            /* eslint-enable max-len */
        });
    });
});
