const SourceMapConsumer = require('source-map').SourceMapConsumer,
    SourceMapGenerator = require('source-map').SourceMapGenerator;

// NOTE: taken from source-map/util.js
/**
 * Make a path relative to a URL or another path.
 *
 * @param {string} aRoot The root path or URL.
 * @param {string} aPath The path or URL to be made relative to aRoot.
 * @returns {string}
 */
function relative(aRoot, aPath) {
    if(aRoot === '') {
        aRoot = '.';
    }

    aRoot = aRoot.replace(/\/$/, '');

    // It is possible for the path to be above the root. In this case, simply
    // checking whether the root is a prefix of the path won't work. Instead, we
    // need to remove components from the root one by one, until either we find
    // a prefix that fits, or we run out of components to remove.
    let level = 0;
    while(aPath.indexOf(aRoot + '/') !== 0) {
        const index = aRoot.lastIndexOf('/');
        if(index < 0) {
            return aPath;
        }

        // If the only part of the root that is left is the scheme (i.e. http://,
        // file:///, etc.), one or more slashes (/), or simply nothing at all, we
        // have exhausted all components, so the path is not relative to the root.
        aRoot = aRoot.slice(0, index);
        if(aRoot.match(/^([^\/]+:\/)?\/*$/)) {
            return aPath;
        }

        ++level;
    }

    // Make sure we add a "../" for each component we removed from the root.
    return Array(level + 1).join('../') + aPath.substr(aRoot.length + 1);
}


/**
 * Take a raw source map from previous loader and apply adjustments related to the modifications
 * made to `modifiedNodes`. Each node in `modifiedNodes` is expected to have 'loc' entry containing
 * the original source's coordinates, while the transformed source is retrieved via node.source().
 * @param {Object} inputSourceMap
 * @param {Array} modifiedNodes
 * @returns {Object}
 */
function updateSourceMapOffsets(inputSourceMap, modifiedNodes) {
    const sourceMapConsumer = new SourceMapConsumer(inputSourceMap);
    const sourceRoot = sourceMapConsumer.sourceRoot;
    const sourceMapGenerator = new SourceMapGenerator({
        file : sourceMapConsumer.file,
        sourceRoot : sourceRoot
    });

    const copyMapping = (srcMapping, lineOffset) => {
        const newMapping = {
            generated : {
                line : srcMapping.generatedLine + lineOffset,
                column : srcMapping.generatedColumn
            }
        };

        if(srcMapping.source !== null && srcMapping.originalLine !== null) {
            newMapping.source = srcMapping.source;
            if(sourceRoot != null) {
                newMapping.source = relative(sourceRoot, newMapping.source);
            }

            newMapping.original = {
                line : srcMapping.originalLine,
                column : srcMapping.originalColumn
            };

            if(srcMapping.name != null) {
                newMapping.name = srcMapping.name;
            }
        }

        sourceMapGenerator.addMapping(newMapping);
    };

    modifiedNodes = modifiedNodes.slice();

    // Since we're dealing with async operations, ensure that modified nodes are properly sorted
    modifiedNodes.sort((node1, node2) => {
        if(node1.loc.start.line === node2.loc.start.line) {
            return node1.loc.start.column - node2.loc.start.column;
        } else {
            return node1.loc.start.line - node2.loc.start.line;
        }
    });

    let lineOffset = 0;
    let currentNode = modifiedNodes.shift();

    sourceMapConsumer.eachMapping((inputMapping) => {
        copyMapping(inputMapping, lineOffset);
        if(currentNode && currentNode.loc.start.line === inputMapping.generatedLine) {
            // When one-line require() is expanded into N require()-s, each new generated line
            // should point to the original one-liner. We don't care about column transformations
            // since there is one import/require per line.
            let additionalLines = currentNode.source().split('\n').length - 1;
            while(additionalLines > 0) {
                lineOffset++;
                copyMapping(inputMapping, lineOffset);
                additionalLines--;
            }
            currentNode = modifiedNodes.shift();
        }
    });

    return Object.assign({}, sourceMapGenerator.toJSON(), { sourcesContent : inputSourceMap.sourcesContent });
}

module.exports = updateSourceMapOffsets;
