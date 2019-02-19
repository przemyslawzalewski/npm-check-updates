var _ = require('lodash');
var cint = require('cint');
var Promise = require('bluebird');
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

            return _.values(response)[0][field];
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

        return spawn(process.platform === 'win32'? 'npm.cmd' : 'npm', ['ls', '--json', '-depth=0'], {cwd: options.cwd})
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
        return view(packageName, 'versions').then(_.last);
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
