
/**
 * @param {BemFile[]} files
 * @returns {String}
 */
module.exports = function generateJsStr(files) {
    return files
        .reduce((acc, file, i) => acc.concat(
            i !== files.length - 1
                ? `require('${file.path}'),`
                : `(require('${file.path}').default || require('${file.path}')).applyDecls()`
        ), ['('])
        .concat(')')
        .join('\n');
};
