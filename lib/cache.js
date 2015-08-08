'use strict';

// Imports
var moment = require('moment'),
    _ = require('lodash'),
    emitter = new (require('events').EventEmitter);

var cache = {},
    definitions = {},
    expirations = {},
    waitingFor = {},
    DEFAULT_OPTIONS = {
        lifespan: 2*60*60, // 2 hours
        autoWarmup: false
    },
    ERROR_MESSAGES = {
        cacheMiss: 'ERR_CACHE_MISS',
        keyNotFound: 'ERR_NOT_FOUND'
    };

// Public API functions
var get, updateCache, define, isCacheExpired;


// Cache get function.
// If the cache key is defined and not marked as expired, the memoized data is
// passed to the callback function. If the cache key is expired, the cache will
// try to update itself; if it fails to do so, a ERR_CACHE_MISS error is passed
// instead.
get = function get (key, getCallback) {
    module.exports.verbose && console.log('CacheLookup', 'Fetching ' + key);
    if (cache[key] && !isCacheExpired(key)) {
        module.exports.verbose && console.log('CacheLookup', 'Found ' + key);
        getCallback(null, cache[key]);
    } else if (waitingFor[key]) {
        module.exports.verbose && console.log('CacheLookup', 'Waiting update for ' + key);
        emitter.on(waitingFor[key], getCallback);
    } else {
        var updateCallback = function updateCallback (error, response) {
            if (error) {
                getCallback(new Error(ERROR_MESSAGES.cacheMiss + ":" + error.message));
            } else {
                getCallback(null, response);
            }
        };
        module.exports.verbose && console.log('CacheLookup', 'Expired ' + key);
        updateCache(key, updateCallback);
    }
};

// Updates a cache key data and expiration time from its definition.
// A ERR_NOT_FOUND error may be triggered if the given key hasn't been defined.
updateCache = function updateCache (key, updateCallback) {
    if (!definitions[key]) {
        module.exports.verbose && console.log('CacheLookup', 'Didnt find ' + key);
        updateCallback(new Error(key.toString() + "::" + ERROR_MESSAGES.keyNotFound));
    } else {
        var timestamp = new Date().getTime(),
            callback = function callback (error, data) {
                if (!error) {
                    cache[key] = data;
                    expirations[key] = moment();
                }
                waitingFor[key] = null;
                updateCallback(error, data);
            };
        module.exports.verbose && console.log('CacheLookup', 'Updating ' + key);
        waitingFor[key] = key + '' + timestamp;
        emitter.on(key + '' + timestamp, callback);

        definitions[key](function (error, response) {
            emitter.emit(key + '' + timestamp, error, response);
        });
    }
};

// This function defines a new cache key.
// After the cache key is defined, the cache of that same key is refreshed.
// Any errors caugth during the first fetch are logged using console.log.
//
// The options object can contain the following properties:
// - lifespan: How long will a cache be live before being marked as expired.
//
// The definition function is expected to only recieve a callback parameter.
define = function define (key, options, definitionFn) {
    var _opts = _.assign(DEFAULT_OPTIONS, options || {}),
        defineCallback = function (error, data) {
            module.exports.verbose && console.log(error || key + ' cache defined succesfully');
        };

    definitions[key] = definitionFn;
    definitions[key].lifespan = _opts.lifespan;
    // Reset cache
    cache[key] = null;
    if(_opts.autoWarmup) {
        // Cache warmup
        updateCache(key, defineCallback);
    }
};

// This function returns true if the cache of the given key is expired
isCacheExpired = function isCacheExpired (key) {
    return expirations[key] &&
            moment().diff(expirations[key], 'ms')/1000 > definitions[key].lifespan;
};

module.exports = {
    define: define,
    isCacheExpired: isCacheExpired,
    get: get,
    updateCache: updateCache
};
