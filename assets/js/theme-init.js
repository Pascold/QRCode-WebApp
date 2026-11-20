/*
 * Static build only: applies the saved light/dark theme from localStorage
 * before the page is painted (the PHP version does this on the server).
 * Loaded synchronously in <head>.
 */
(function () {
    'use strict';

    var script = document.currentScript;
    try {
        if (localStorage.getItem(script.dataset.consentKey) !== '1') {
            return;
        }
        var theme = localStorage.getItem(script.dataset.themeKey);
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.setAttribute('data-theme', theme);
        }
    } catch (error) {
        // Storage blocked - follow the operating system theme.
    }
})();
