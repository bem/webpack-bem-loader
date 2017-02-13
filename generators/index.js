
/**
 * @param {BemFile[]} files
 * @returns {String}
 */
function generateStr(files) {
    return files
        .map(file => `require('${file.path}');`)
        .join('\n');
}

/**
 * @param {BemFile[]} files
 * @returns {String}
 */
function generateJsStr(files) {
    return files
        .reduce((acc, file, i) => acc.concat(
            i !== files.length - 1
                ? `require('${file.path}'),`
                : `(require('${file.path}').default || require('${file.path}')).applyDecls()`
        ), ['('])
        .concat(')')
        .join('\n');
}

module.exports = {
    js : generateJsStr,
    '*' : generateStr
};
