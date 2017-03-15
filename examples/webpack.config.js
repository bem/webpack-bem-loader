const path = require('path');

module.exports = {
    module: {
        loaders: [
            { test: /\.js$/, loader: 'webpack-bem' }
        ]
    },
    bemLoader: {
        naming: {
            elem: '__',
            elemDirPrefix: '__',
            modDirPrefix: '_'
        },
        techs: ['js'],
        levels: [
            `${__dirname}/common.blocks`
        ]
    },
    resolveLoader: { root: path.resolve('../../') }
};
