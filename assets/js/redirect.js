/*
 * Static build only (GitHub Pages).
 *
 * Start page (index.html): opens the saved language, or the best match for
 * the browser languages, e.g. "de-AT" -> "de-AT/", "sr-Latn-RS" -> "sr-Latn/",
 * "no" -> "nb/".
 *
 * 404 page (404.html): fixes the letter case of language URLs such as
 * "/en-gb/" -> "/en-GB/"; anything else goes to the start page.
 */
(function () {
    'use strict';

    var config = JSON.parse(document.getElementById('redirect-config').textContent);
    var lookup = config.lookup;

    /** Tries "sr-latn-rs", then "sr-latn", then "sr". */
    function match(tag) {
        var parts = String(tag || '').toLowerCase().replace(/_/g, '-').split('-');
        for (var length = parts.length; length > 0; length--) {
            var code = lookup[parts.slice(0, length).join('-')];
            if (code) {
                return code;
            }
        }
        return null;
    }

    function stored(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    var target;

    if (config.mode === '404') {
        var path = window.location.pathname;
        var rest = path.indexOf(config.base) === 0 ? path.slice(config.base.length) : '';
        var code = lookup[(rest.split('/')[0] || '').toLowerCase()];
        target = config.base + (code ? code + '/' : '');
        if (target === path) {
            // Avoid a redirect loop on a genuinely missing page.
            target = config.base;
        }
    } else {
        var language = null;
        if (stored(config.consentKey) === '1') {
            language = match(stored(config.languageKey));
        }
        var browserLanguages = navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language || navigator.userLanguage];
        for (var i = 0; !language && i < browserLanguages.length; i++) {
            language = match(browserLanguages[i]);
        }
        target = (language || config.defaultLanguage) + '/';
    }

    window.location.replace(target);
})();
