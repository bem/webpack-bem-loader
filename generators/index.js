module.exports = generators => Object.assign({
    js : require('./js'),
    '*' : require('./general')
}, generators);
