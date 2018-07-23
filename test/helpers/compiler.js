const path = require('path');
const webpack = require('webpack');
const MemoryFS = require('memory-fs');

const { version } = webpack;

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

const optimize = config => {
    if(Number(version[0]) >= 4) {
        config.optimization = config.optimization || {
            namedChunks : true,
            namedModules : true,
            runtimeChunk : true,
            occurrenceOrder : true
        };
    }

    return config;
};

const plugins = config =>
    [
        Number(version[0]) >= 4
            ? false
            : new webpack.optimize.CommonsChunkPlugin({
                names : ['runtime'],
                minChunks : Infinity
            })
    ]
    .concat(config.plugins || [])
    .filter(Boolean);

const mode = config => {
    if(Number(version[0]) >= 4) {
        config.mode = config.mode || 'development';
    }

    return config;
};

module.exports = function(fixture, { config, mock }) {
    const testDir = process.cwd();
    const output = {
        path : path.resolve('output'),
        filename : '[name].bundle.js'
    };
    const webpackConfig = {
        devtool : config.devtool || false,
        context : testDir,
        entry : `./${fixture}`,
        output,
        module : _module(config),
        plugins : plugins(config),
        resolve : {
            extensions : ['.ts', '.tsx', '.js', '.jsx', '.json']
        }
    };

    mode(webpackConfig);

    // Compiler Optimizations
    optimize(webpackConfig);

    const compiler = webpack(webpackConfig);

    const fs = new MemoryFS();

    compiler.outputFileSystem = fs;

    if(mock) {
        // I don't know why wepack4 need this
        // ~ 1 hour lost here
        mock['index.js'] || (mock['index.js'] = 'Fuck webpack 4');

        mockFS(fs)(mock, testDir);
        // HACK for css-loader cause it's stupid
        mockFS(fs)({
            'node_modules/css-loader' : {
                'index.js' : require('fs').readFileSync('node_modules/css-loader/index.js'),
                'lib' : {
                    'css-base.js' : require('fs').readFileSync('node_modules/css-loader/lib/css-base.js')
                }
            }
        });
        mockFS(fs)({
            'node_modules/mini-css-extract-plugin/dist' : {
                'loader.js' : require('fs').readFileSync('node_modules/mini-css-extract-plugin/dist/loader.js')
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
