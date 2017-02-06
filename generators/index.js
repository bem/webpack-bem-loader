
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
function generateReactStr(files) {
    const apply = require => `${require}.default ?
        ${require}.default.applyDecls() :
        ${require}.applyDecls()`;

    const reqStr = file => {
        return `require('${file.path}')`;
    };

    return files
        .reduce((acc, file, i) => {
            return acc.concat(
                i === files.length - 1
                ? `\treturn ${apply(reqStr(file))};`
                : `\t${reqStr(file)};`
            )
        }, ['(function() {'])
        .concat('})();')
        .join('\n');
}


module.exports = {
    js : generateReactStr,
    '*' : generateStr
};
