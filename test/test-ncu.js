var ncu             = require('../lib/npm-check-updates.js');
var chai            = require('chai');
var fs              = require('fs');
var spawn           = require('spawn-please');

chai.use(require('chai-as-promised'));
chai.use(require('chai-string'));

spawn.Promise = Promise;

describe('npm-check-updates', function () {

    this.timeout(30000);

    describe('run', function () {
        it('should return promised jsonUpgraded', function () {
            const packageData = fs.readFileSync(__dirname + '/ncu/package.json', 'utf-8');
            return ncu.run({
                packageData
            }).should.eventually.have.property('express');
        });

        it('should filter by package name with one arg', function () {
            const packageData = fs.readFileSync(__dirname + '/ncu/package2.json', 'utf-8');
            var upgraded = ncu.run({
                packageData,
                args: ['lodash.map']
            });
            return Promise.all([
                upgraded.should.eventually.have.property('lodash.map'),
                upgraded.should.eventually.not.have.property('lodash.filter')
            ]);
        });

        it('should filter by package name with multiple args', function () {
            const packageData = fs.readFileSync(__dirname + '/ncu/package2.json', 'utf-8');
            var upgraded = ncu.run({
                packageData,
                args: ['lodash.map', 'lodash.filter']
            });
            return Promise.all([
                upgraded.should.eventually.have.property('lodash.map'),
                upgraded.should.eventually.have.property('lodash.filter')
            ]);
        });

        it('should suggest upgrades to versions within the specified version range if jsonUpraded is true and upgradeAll is not given (backwards compatible behavior until next version)', function () {
            var upgraded = ncu.run({
                // juggernaut has been deprecated at v2.1.1 so it is unlikely to invalidate this test
                packageData: '{ "dependencies": { "juggernaut": "^2.1.0" } }',
                jsonUpgraded: true
            });

            return Promise.all([
                upgraded.should.eventually.have.property('juggernaut'),
                upgraded.then(function (data) {
                    return data.should.eql({juggernaut: '^2.1.1'});
                })
            ]);
        });

        it('should not suggest upgrades to versions within the specified version range if jsonUpraded is true and upgradeAll is explicitly set to false', function () {
            var upgraded = ncu.run({
                // juggernaut has been deprecated at v2.1.1 so it is unlikely to invalidate this test
                packageData: '{ "dependencies": { "juggernaut": "^2.1.0" } }',
                jsonUpgraded: true,
                upgradeAll: false
            });

            return upgraded.should.eventually.not.have.property('juggernaut');
        });

        it('should ignore newer packages that satisfy the declared version range if they are installed in node_modules', function () {

            var upgraded = ncu.run({
                // { "dependencies": { "escape-string-regexp": "^1.0.4" } }
                // latest is 1.0.5
                packageFile: 'test/test-modules/package.json',
                packageFileDir: true, // appears to be redundant with upgradeAll in this test case, but it's already built so I give up :(. Too much effort to satisfy an edge case (#201).
                jsonUpgraded: true,
                upgradeAll: false
            });

            return upgraded.should.eventually.not.have.property('escape-string-regexp');
        });

        it('should throw an exception instead of printing to the console when timeout is exceeded', function () {

            return ncu.run({
                packageFile: 'package.json',
                timeout: 1
            }).then(function () {
                throw new Error('False positive');
            }).catch(function (e) {
                return e.message.should.contain('Exceeded global timeout of 1ms');
            });
        });
    });

    describe('cli', function () {

        it('should read --packageFile', function () {
            var tempFile = './test/temp_package.json';
            fs.writeFileSync(tempFile, '{ "dependencies": { "express": "1" } }', 'utf-8');
            return spawn('node', ['bin/ncu', '--jsonUpgraded', '--packageFile', tempFile])
                .then(response => {
                    const parsed = JSON.parse(response);
                    return parsed;
                })
                .then(function (pkgData) {
                    pkgData.should.have.property('express');
                })
                .finally(function () {
                    fs.unlinkSync(tempFile);
                });
        });

        it('should write to --packageFile', function () {
            var tempFile = './test/temp_package.json';
            fs.writeFileSync(tempFile, '{ "dependencies": { "express": "1" } }', 'utf-8');
            return spawn('node', ['bin/npm-check-updates', '-u', '--packageFile', tempFile])
                .then(function () {
                    var upgradedPkg = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
                    upgradedPkg.should.have.property('dependencies');
                    upgradedPkg.dependencies.should.have.property('express');
                    upgradedPkg.dependencies.express.should.not.equal('1');
                })
                .finally(function () {
                    fs.unlinkSync(tempFile);
                });
        });

        it('should not write to --packageFile if error-level=2 and upgrades', function () {
            var tempFile = './test/temp_package.json';
            fs.writeFileSync(tempFile, '{ "dependencies": { "express": "1" } }', 'utf-8');
            return spawn('node', ['bin/npm-check-updates', '-u', '--error-level', '2', '--packageFile', tempFile])
                .catch(function () {
                    var upgradedPkg = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
                    upgradedPkg.should.have.property('dependencies');
                    upgradedPkg.dependencies.should.have.property('express');
                    upgradedPkg.dependencies.express.should.equal('1');
                })
                .finally(function () {
                    fs.unlinkSync(tempFile);
                });
        });

        it('should ignore stdin if --packageFile is specified', function () {
            var tempFile = './test/temp_package.json';
            fs.writeFileSync(tempFile, '{ "dependencies": { "express": "1" } }', 'utf-8');
            return spawn('node', ['bin/npm-check-updates', '-u', '--packageFile', tempFile], '{ "dependencies": {}}')
                .then(function () {
                    var upgradedPkg = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
                    upgradedPkg.should.have.property('dependencies');
                    upgradedPkg.dependencies.should.have.property('express');
                    upgradedPkg.dependencies.express.should.not.equal('1');
                })
                .finally(function () {
                    fs.unlinkSync(tempFile);
                });
        });

    });

});
