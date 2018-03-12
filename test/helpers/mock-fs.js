const path = require('path');

/**
  Recreate mock-fs interface:

  ```
  const mock = require('mock-fs');

  mock({
    'path/to/fake/dir': {
      'some-file.txt': 'file content here',
      'empty-dir': {/ empty directory /}
    },
    'path/to/some.png': new Buffer([8, 6, 7, 5, 3, 0, 9]),
    'some/other/path': {/ another empty directory /}
  });
  ```
*/

const createFile = (fs, path, content) => fs.writeFileSync(path, content);
const createDir = (fs, path) => fs.mkdirpSync(path);

function populate(fs, paths, currentDir) {
    Object.keys(paths).forEach(pathKey => {
        const curPath = path.join(currentDir, pathKey);
        const content = paths[pathKey];
        if(typeof content === 'string' || Buffer.isBuffer(content)) {
            createFile(fs, curPath, content);
        } else {
            createDir(fs, curPath);
            populate(fs, content, curPath);
        }
    });
}

function popuplateBase(fs, dir) {
    const currentDir = path.dirname(dir);
    if(currentDir === dir) return;
    popuplateBase(fs, currentDir);
    createDir(fs, currentDir);
}

function mock(fs, paths, currentDir=process.cwd()) {
    popuplateBase(fs, currentDir);
    createDir(fs, currentDir);
    populate(fs, paths, currentDir);
}

module.exports = fs => mock.bind(mock, fs);
