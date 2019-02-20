var packageManagers = require('../../lib/package-managers');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

var should = chai.should();
chai.use(chaiAsPromised);

describe('package-managers', function () {

    // for(var name in packageManagers) {
    //     describe(name, function () {

    describe('npm', function () {
        this.timeout(30000);

        var pkgManager = packageManagers.npm;

        before(function () {
            return pkgManager.init();
        });

        it('list', async () => {
            const pkg = await pkgManager.list();
            const { dependencies: { semver } } = pkg;
            return semver !== undefined;
        });

        it('latest', function () {
            return pkgManager.latest('semver').then(parseInt).should.eventually.be.above(1);
        });

        it('greatest', function () {
            return pkgManager.greatest('semver').then(parseInt).should.eventually.be.above(1);
        });

    });

});
