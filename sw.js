/*
 * QR Code Generator - offline support (service worker).
 *
 * Keeps a copy of this site's own files in the browser so the generator
 * also works without an internet connection after the first visit.
 * It only stores files downloaded from this site - nothing you enter or
 * upload is stored here or sent anywhere.
 *
 *  - Pages:  network first, the saved copy is used when offline.
 *  - Files:  saved copy first; files without a "?v=" version are refreshed
 *            in the background so they never go stale for long.
 */
'use strict';

var CACHE = 'qr-offline-v1';

// Loaded on demand by the app, so they are saved up front.
// (The 3.5 MB AVIF encoder is saved the first time it is used.)
var PRECACHE = [
    'assets/vendor/jsqr/jsQR.js',
    'assets/vendor/gifenc/gifenc.esm.js',
    'manifest.webmanifest',
    'assets/img/favicon.svg'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE)
            .then(function (cache) { return cache.addAll(PRECACHE); })
            .catch(function () { /* offline install is best effort */ })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                return Promise.all(names.filter(function (name) {
                    return name.indexOf('qr-offline-') === 0 && name !== CACHE;
                }).map(function (name) { return caches.delete(name); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

/** Saves a response; drops older versions ("?v=") of the same file. */
function store(request, response) {
    if (!response || !response.ok || response.type !== 'basic') {
        return Promise.resolve();
    }
    var copy = response.clone();
    var url = new URL(request.url);
    return caches.open(CACHE).then(function (cache) {
        var cleanup = Promise.resolve();
        if (url.searchParams.has('v')) {
            cleanup = cache.keys().then(function (keys) {
                return Promise.all(keys.filter(function (key) {
                    var other = new URL(key.url);
                    return other.pathname === url.pathname && other.search !== url.search;
                }).map(function (key) { return cache.delete(key); }));
            });
        }
        return cleanup.then(function () { return cache.put(request, copy); });
    });
}

function fromCache(request) {
    return caches.match(request).then(function (hit) {
        // Offline: an older version of the same file is better than nothing.
        return hit || caches.match(request, { ignoreSearch: true });
    });
}

function handlePage(event) {
    var request = event.request;
    return fetchAndStore(event)
        .catch(function () {
            return fromCache(request).then(function (hit) {
                if (hit) {
                    return hit;
                }
                // Any saved page of the app (e.g. another language) still works.
                return caches.open(CACHE).then(function (cache) {
                    return cache.keys().then(function (keys) {
                        var page = keys.filter(function (key) {
                            return key.mode === 'navigate' || /\/(index\.(php|html))?(\?.*)?$/.test(key.url);
                        })[0];
                        return page ? cache.match(page) : Response.error();
                    });
                });
            });
        });
}

function fetchAndStore(event) {
    return fetch(event.request).then(function (response) {
        event.waitUntil(store(event.request, response));
        return response;
    });
}

function handleFile(event) {
    var request = event.request;
    var versioned = new URL(request.url).searchParams.has('v');
    return caches.match(request).then(function (hit) {
        if (hit) {
            if (!versioned) {
                // Refresh in the background for the next visit.
                event.waitUntil(fetchAndStore(event).catch(function () {}));
            }
            return hit;
        }
        return fetchAndStore(event).catch(function () {
            return fromCache(request).then(function (old) {
                return old || Response.error();
            });
        });
    });
}

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }
    if (request.mode === 'navigate') {
        event.respondWith(handlePage(event));
    } else {
        event.respondWith(handleFile(event));
    }
});
