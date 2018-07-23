const required = require('required-path');

module.exports = function getModuleById(stats, id) {
    const moduleId = required(id);
    const { modules } = stats.toJson();
    const module = [].concat(modules).find(module => {
        return module.id === moduleId;
    });

    if(!module) {
        throw new Error(stats.toString({
            colors : true,
            errorDetails : true,
            moduleTrace : true
        }));
    }

    return module;
};
