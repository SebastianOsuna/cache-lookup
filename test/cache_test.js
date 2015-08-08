'use strict';

var expect = require('chai').expect;

describe("CacheLookup", function () {

    var cache = require('../lib/cache');
    cache.verbose = false;

    describe("API", function () {

        it("should have the basic feautes", function () {
            expect(cache).to.have.property('get');
            expect(cache).to.have.property('define');
            expect(cache).to.have.property('updateCache');
            expect(cache).to.have.property('isCacheExpired');
        });

    });

    describe("#define", function () {
        var cache1Data = { a: 1, b: 2 },
            cacheFn = function cacheFn (callback) {
                callback(null, cache1Data);
            };

        it("should let describe cache keys", function () {
            var subject1 = cache.define('cache1', {}, cacheFn),
                subject2 = cache.define('cache2', null, cacheFn);
            expect(subject1).to.be.eq(undefined)
            expect(subject2).to.be.eq(undefined)
        });

    });

    describe("#get", function () {

        it("should return the correct data", function (done) {
            cache.define('cache3', {}, function definition (callback) {
                callback(null, { a: 1 });
            });
            cache.get('cache3', function (e, response) {
                expect(response).to.have.property('a');
                expect(response.a).to.be.eq(1);
                done();
            });
        });

        it("should update if cache expires", function (done) {
            var c = 0,
                firstTickResponse;
            cache.define('cache4', { lifespan: 0.05 /* 50 ms */ }, function definition (callback) {
                c++;
                callback(null, { a: c + 1 });
            });
            cache.get('cache4', function (e, response) {
                firstTickResponse = response;
            });
            setTimeout(function tick () {
                cache.get('cache4', function (e, response) {
                    expect(firstTickResponse.a).to.be.eq(c);
                    expect(response.a).to.be.eq(c+1);
                    done();
                });
            }, 51);
        });

        it("should wait if updating", function (done) {
            var c = 0,
                firstTickResponse,
                secondTickResponse;
            cache.define('cache5', { autoWarmup: false, lifespan: 0.05 /* 50 ms */ }, function definition (callback) {
                c++;
                setTimeout(function fetch () {
                    callback(null, { a: c + 1 });
                }, 50);
            });

            cache.get('cache4', function (e, response) {
                firstTickResponse = response;
            });

            // In this one it should be in the middle of the update
            setTimeout(function tick2 () {
                cache.get('cache4', function (e, response) {
                    secondTickResponse = response;
                });
            }, 20);

            setTimeout(function tick2 () {
                cache.get('cache4', function (e, response) {
                    expect(firstTickResponse.a).to.be.eq(secondTickResponse.a);
                    expect(firstTickResponse.a).to.not.be.eq(response.a);
                    done();
                });
            }, 52);
        });

        it("should give a NOT FOUND error", function () {
            cache.get('notADefinedCache', function (error, r) {
                expect(error).to.not.be.null;
                expect(error).to.have.property('message');
                expect(error.message.indexOf('ERR_NOT_FOUND')).to.be.gt(-1);
            });
        });

        it("should give a CACHE MISS error if definition fails", function () {
            cache.define('cache3', { lifespan: 0.05 /* 50 ms */ }, function definition (callback) {
                callback(new Error('Faked error'));
            });
            cache.get('cache3', function (error, r) {
                expect(error).to.not.be.null;
                expect(error).to.have.property('message');
                expect(error.message.indexOf('ERR_CACHE_MISS')).to.be.gt(-1);
            });
        });

    });

    describe("#isCacheExpired", function () {

        it("should check for expired cache", function (done) {
            cache.define('cache3', { lifespan: 0.05 /* 50 ms */ }, function definition (callback) {
                callback(null, { a: 1 });
            });
            setTimeout(function tick () {
                expect(cache.isCacheExpired('cache3')).to.be.true;
                done();
            }, 52);
        });

    });


});
