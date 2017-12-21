const path = require('path');
const requiredPath = require('required-path');

const strLang = (file, lang) => `
if (
    process.env.BEM_LANG?
        process.env.BEM_LANG === '${lang}' :
        process.env.REACT_APP_BEM_LANG?
            process.env.REACT_APP_BEM_LANG === '${lang}' :
            'en' === '${lang}'
) {
    return core()
        .decl(require('${requiredPath(path.join(file.path, lang))}'))
        ('${file.cell.entity.id}');
}
`;

const langEnvErr = (env, langs) => `process.env.${env} && `
    + `console.error('No match of process.env.${env} { ' + process.env.${env} + ' } `
    + `in provided langs: { ${langs.join(', ')} }');`;

const onlyDEV = strings => `
if (process.env.NODE_ENV === 'development') {
    ${strings.join('\n')}
}
`;

function generateI18n(langs, files) {

    return files
        .reduce((acc, file) => {
            return acc.concat(langs.map(lang => strLang(file, lang)));
        }, ['(function() {', `var core = require('${requiredPath(path.join(__dirname, 'core'))}');`])
        .concat([
            onlyDEV([
                langEnvErr('BEM_LANG', langs),
                langEnvErr('REACT_APP_BEM_LANG', langs)
            ]),
            'return function(){};\n})()'
        ])
        .join('\n');
}

module.exports = {
    generate : function(langs) {
        return generateI18n.bind(null, langs);
    }
};
