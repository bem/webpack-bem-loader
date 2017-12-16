# Webpack BEM loader

[Webpack](https://github.com/webpack/webpack) loader for [bem-react-core](https://github.com/bem/bem-react-core)

BEM entities auto resolver for custom import strings:

``` js
import Block from 'b:block';
import Block from 'b:block m:modName';
import Block from 'b:block m:modName=modVal1|modVal2';
import BlockElem from 'b:block e:elem';
import BlockElem from 'b:block e:elem m:modName';
import BlockElem from 'b:block e:elem m:modName=modVal1|modVal2';
```

## Install

> npm i -D webpack-bem-loader

## Usage

In your `webpack.config.js`.

#### Webpack 1

``` js
  // setting for bem-loader
  bemLoader: {
    naming: 'react',
    levels: ['./pathToBlocks'],
    // OR:
    // levels: {
    //     './pathToBlocks': {
    //         default: true,
    //         scheme: 'nested',
    //         naming: 'origin'
    //     }
    // },
    // OR for a few entires:
    // levels: [
    //     [
    //         './pathToEntryOneBlocks',
    //         './pathToEntryOneOverrides'
    //     ],
    //     [
    //         './pathToEntryTwoBlocks',
    //         './pathToEntryTwoOverrides'
    //     ]
    // ],
    techs: ['js', 'css'],
    techMap: {
        js : ['react.js']
    },
    langs: ['ru', 'en'],
    generators: {
        js: null
    }
    // OR:
    // generators: {
    //     js: (files) => {
    //         return files
    //             .map(file => `require('${file.path}')`)
    //             .join(',\n');
    //     }
    // }
  },
```

#### Webpack 2

``` js
// setting for bem-loader
module: {
    rules: [
        {
            test : /\react.js$/,
            loader: 'webpack-bem-loader',
            options: {
                naming: 'react',
                levels: ['./pathToBlocks'],
                // OR:
                // levels: {
                //     './pathToBlocks': {
                //         default: true,
                //         scheme: 'nested',
                //         naming: 'origin'
                //     }
                // },
                // OR for a few entires:
                // levels: [
                //     [
                //         './pathToEntryOneBlocks',
                //         './pathToEntryOneOverrides'
                //     ],
                //     [
                //         './pathToEntryTwoBlocks',
                //         './pathToEntryTwoOverrides'
                //     ]
                // ],
                techs: ['js', 'css'],
                techMap: {
                    js : ['react.js']
                },
                langs: ['ru', 'en'],
                generators: {
                    js: null
                }
                // OR:
                // generators: {
                //     js: (files) => {
                //         return files
                //             .map(file => `require('${file.path}')`)
                //             .join(',\n');
                //     }
                // }
            }
        }
    ]
}
```

## Options

- __naming__: [bem-naming](https://en.bem.info/toolbox/sdk/bem-naming) overrides
- __levels__ <Array>: paths to components declarations
- __techs__ <Array>: list of techs extensions for require in runtime, `['js']` by default
- __techMap__ <Object>: mapping of techs to extensions. Example: `{ 'js' : ['react.js', 'react.ts', 'react.es'], 'css' : ['post.css'] }`
- __langs__ <Array>: list of langs in which resloves '.i18n' tech
- __generators__ <Object>: customization of code generators by tech. The function when it is provided receive one argument: __files__ with signature `Array<String>`. This is the list of files of the specified technology, got from current import. Examples: `{ js : null }` or ```{ js: (files) => files.map(file => `require('${file.path}')`).join(',\n') }```

## i18n

`.i18n` - represent special technology that provides the opportunity to localize components.

On file system:

```
blocks/Attach/
├── Attach.react.js
├── Attach.i18n
│   ├── en.js
│   ├── ru.js
│   └── tr.js
└── Attach.spec.js
```

`en.js`, `ru.js` and `tr.js` are keysets and should be common.js modules.

```sh
$ cat blocks/Attach/Attach.i18n/tr.js
module.exports = {
    "Attach": {
        "button-text": "Dosya seç",
        "no-file": "dosya seçilmedi"
    }
};
```

inside `Attach.js`:

```js
import i18n from `b:Attach t:i18n`

console.log(i18n('button-text')) // → Dosya seç
```

`webpack-bem-loader` transpiles such code to

```js
var i18n = (function() {
    var core = require('/absolute-path-to/webpack-bem-loader/generators/i18n/core');

    if (process.env.BEM_LANG === 'ru') {
        return core().decl(require('../Attach.i18n/ru'))('Attach')
    }

    if (process.env.BEM_LANG === 'en') {
        return core().decl(require('../Attach.i18n/en'))('Attach')
    }

    if (process.env.BEM_LANG === 'tr') {
        return core().decl(require('../Attach.i18n/tr'))('Attach')
    }
})();

console.log(i18n('button-text')) // → Dosya seç
```

`process.env.BEM_LANG` is need to be defined. `ru`, `en` and `tr` are taken from `langs` option.


### License MPL-2.0
