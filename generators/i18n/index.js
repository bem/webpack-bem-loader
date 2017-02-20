var path = require('path'),
    requiredPath = require('required-path');

function generateI18n(langs, files) {
    const strLang = (file, lang) => `
        if (process.env.BEM_LANG === '${lang}') {
            return core
                .decl(require('${requiredPath(path.join(file.path, lang))}'))
                ('${file.cell.entity.id}');
        }`;

    // TODO
    // import i18n from 'b:attach t:i18n'
    // var i18n = (function(){
    //     if(process.env.BEM_LANG === 'ru'){
    //         return require('core')
    //             .decl(require('common/ru'))
    //             .decl(require('desktop/ru'))
    //             ('attach');
    //     }

    return files
        .reduce(
            (acc, file) => acc.concat(langs.map(lang => strLang(file, lang))),
            ['(function() {', `var core = require('${requiredPath(path.join(__dirname, 'core'))}');`])
        .concat([
            'throw Error(\'I18N: No lang files\');',
            '})()'
        ])
        .join('\n');
}

module.exports = {
    generate : function(langs) {
        return generateI18n.bind(null, langs);
    }
};
