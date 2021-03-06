var _ = require('lodash');
var cint = require('cint');
var fetch = require('node-fetch');
var versionUtil = require('../version-util.js');
var spawn = require('spawn-please');
var initialized = false;

/**
 * @param packageName   Name of the package
 * @param field         Field such as "versions" or "dist-tags.latest" accepted by npm.commands.view (https://docs.npmjs.com/api/view)
 * @Returns             Promised result
 */
function view(packageName, field) {
    if (!initialized) {
        throw new Error('init must be called before using the version manager');
    }

    var endpoint = 'https://registry.npmjs.com/' + packageName;

    return fetch(endpoint)
        .then(response => response.json())
        .catch(function (err) {
            // normalize 404 errors
            throw err.statusCode === 404 || err.message.indexOf('404 Not Found') > 0 ? new Error(404) : err;
        })
        .then(function (response) {
            // rare case where npm view returns an empty response
            // https://github.com/tjunnone/npm-check-updates/issues/162
            if (_.isEmpty(response)) {
                throw new Error(404);
            }

            const scoped = _.get(response, field);
            return scoped;
        });
}

module.exports = {

    init: function () {
        initialized = true;
        return Promise.resolve(true);
    },

    /**
     * @args    Arguments for npm ls
     * @options.cwd (optional)
    */
    list: function (args, options) {

        options = options || {};

        if (!initialized) {
            throw new Error('init must be called before using the version manager');
        }

        return spawn(process.platform === 'win32'? 'npm.cmd' : 'npm', ['ls', '--json', '--silent', '-depth=0'], {cwd: options.cwd, rejectOnError: false})
            .catch(error => error)
            .then(JSON.parse)
            // transform results into a similar format as the API
            .then(function (results) {
                return {
                    dependencies: cint.mapObject(results.dependencies, function (name, info) {
                        return cint.keyValue(name, {
                            name: name,
                            version: info.version
                        });
                    })
                };
            });
    },

    latest: cint.partialAt(view, 1, 'dist-tags.latest'),

    newest: function (packageName) {
        return view(packageName, 'time')
            .then(_.keys)
            .then(_.partialRight(_.pullAll, ['modified', 'created']))
            .then(_.last);
    },

    greatest: function (packageName) {
        return view(packageName, 'versions').then(x => _.last(Object.keys(x)));
    },

    greatestMajor: function (packageName, currentVersion) {
        return view(packageName, 'versions').then(function (versions) {
            return versionUtil.findGreatestByLevel(versions, currentVersion, 'major');
        });
    },
    greatestMinor: function (packageName, currentVersion) {
        return view(packageName, 'versions').then(function (versions) {
            return versionUtil.findGreatestByLevel(versions, currentVersion, 'minor');
        });
    }
};
