const path = require('path');
const webpack = require('webpack');
const MemoryFS = require('memory-fs');

const mockFS = require('./mock-fs');

const _module = config => {
    return {
        rules : config.rules || (config.loader ? [{
            test : config.loader.test || /\.js$/,
            use : {
                loader : path.resolve(__dirname, '../..'),
                options : config.loader.options || {}
            }
        }] : [])
    };
};

const plugins = config => ([
    new webpack.optimize.CommonsChunkPlugin({
        name : ['runtime'],
        minChunks : Infinity
    })
].concat(config.plugins || []));


module.exports = function(fixture, { config, mock }) {
    const testDir = process.cwd();
    const output = {
        path : path.resolve('output'),
        filename : '[name].bundle.js'
    };
    const webpackConfig = {
        devtool : config.devtool || 'sourcemap',
        context : testDir,
        entry : `./${fixture}`,
        output,
        module : _module(config),
        plugins : plugins(config)
    };

    const compiler = webpack(webpackConfig);

    const fs = new MemoryFS();

    compiler.outputFileSystem = fs;

    if(mock) {
        mockFS(fs)(mock, testDir);
        // HACK for css-loader cause it's stupid
        mockFS(fs)({
            'node_modules/css-loader/lib' : {
                'css-base.js' : require('fs').readFileSync('node_modules/css-loader/lib/css-base.js')
            }
        });

        compiler.inputFileSystem = fs;
        // FUCK YOU WEBPACK ~ 2hours lost here
        compiler.resolvers.normal.fileSystem = compiler.inputFileSystem;
        compiler.resolvers.context.fileSystem = compiler.inputFileSystem;
    }

    return new Promise((resolve, reject) => compiler.run((err, stats) => {
        if(err) reject(err);

        const assets = Object.values((stats.toJson() || {}).assetsByChunkName || {})
            .reduce((acc, assetsNames) => {
                return acc.concat(assetsNames);
            }, [])
            .reduce((acc, assetName) => {
                return Object.defineProperty(acc, assetName, {
                    enumerable : true,
                    get() {
                        const assetPath = path.join(output.path, assetName);
                        return fs.readFileSync(assetPath, 'utf-8');
                    }
                });
            }, {});

        resolve({ stats, assets, fs });
    }));
};
