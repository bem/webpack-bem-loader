
/**
 * @param {BemFile[]} files
 * @returns {String}
 */
module.exports = function generateStr(files) {
    return files
        .map(file => `require('${file.path}')`)
        .join(',\n');
}

