/*
 * Page chrome: light/dark theme toggle and the language dropdown.
 * Nothing here talks to the server - preferences are kept only in
 * cookies / browser storage on the visitor's own device.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var config = JSON.parse(document.getElementById('app-config').textContent);
    var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    // ------------------------------------------------------------------
    // Preference storage: cookies on a PHP server (so PHP can read them),
    // localStorage on static hosting such as GitHub Pages.
    // ------------------------------------------------------------------

    var prefs = config.storage === 'local' ? {
        get: function (name) {
            try {
                return window.localStorage.getItem(name);
            } catch (error) {
                return null;
            }
        },
        set: function (name, value) {
            try {
                window.localStorage.setItem(name, value);
            } catch (error) {
                // Storage blocked - the preference is simply not remembered.
            }
        }
    } : {
        get: function (name) {
            var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : null;
        },
        set: function (name, value) {
            var secure = window.location.protocol === 'https:' ? ';Secure' : '';
            document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + config.cookieLifetime + ';SameSite=Lax' + secure;
        }
    };

    // Remember the language being viewed, so the start page of the static
    // build (and the PHP version) opens it next time.
    if (prefs.get(config.languageCookie) !== config.language) {
        prefs.set(config.languageCookie, config.language);
    }

    // ------------------------------------------------------------------
    // Theme
    // ------------------------------------------------------------------

    var toggle = document.getElementById('theme-toggle');

    function effectiveTheme() {
        var chosen = root.getAttribute('data-theme');
        if (chosen === 'light' || chosen === 'dark') {
            return chosen;
        }
        return darkQuery && darkQuery.matches ? 'dark' : 'light';
    }

    function updateToggleLabel() {
        // The button always offers the opposite of the current theme.
        var label = effectiveTheme() === 'dark' ? toggle.dataset.labelLight : toggle.dataset.labelDark;
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
    }

    toggle.addEventListener('click', function () {
        var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        // Stored in a cookie so PHP can render the right theme without a flash.
        prefs.set(config.themeCookie, next);
        updateToggleLabel();
    });

    if (darkQuery && darkQuery.addEventListener) {
        darkQuery.addEventListener('change', updateToggleLabel);
    }
    updateToggleLabel();

    // ------------------------------------------------------------------
    // Language dropdown (a <details> element, so it also works without JS)
    // ------------------------------------------------------------------

    var menu = document.getElementById('lang-menu');
    var summary = menu.querySelector('summary');
    var search = document.getElementById('lang-search');
    var items = Array.prototype.slice.call(menu.querySelectorAll('.lang-list li'));
    var empty = document.getElementById('lang-empty');

    function visibleLinks() {
        return items.filter(function (item) { return !item.hidden; }).map(function (item) {
            return item.querySelector('a');
        });
    }

    function filterLanguages() {
        var query = search.value.trim().toLowerCase();
        var visible = 0;
        items.forEach(function (item) {
            var match = query === '' || item.dataset.search.toLowerCase().indexOf(query) !== -1;
            item.hidden = !match;
            if (match) {
                visible++;
            }
        });
        empty.hidden = visible > 0;
    }

    function closeMenu() {
        menu.open = false;
        summary.focus();
    }

    document.addEventListener('click', function (event) {
        if (menu.open && !menu.contains(event.target)) {
            menu.open = false;
        }
    });

    search.addEventListener('input', filterLanguages);

    // Keyboard: arrows move through the results, Enter opens the first match,
    // Escape closes the menu.
    menu.addEventListener('keydown', function (event) {
        var links = visibleLinks();
        var index = links.indexOf(document.activeElement);

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (links.length) {
                    links[Math.min(index + 1, links.length - 1)].focus();
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (index <= 0) {
                    search.focus();
                } else {
                    links[index - 1].focus();
                }
                break;
            case 'Home':
                if (index !== -1 && links.length) {
                    event.preventDefault();
                    links[0].focus();
                }
                break;
            case 'End':
                if (index !== -1 && links.length) {
                    event.preventDefault();
                    links[links.length - 1].focus();
                }
                break;
            case 'Enter':
                if (document.activeElement === search) {
                    event.preventDefault();
                    if (links.length) {
                        window.location.href = links[0].href;
                    }
                }
                break;
            case 'Escape':
                if (menu.open) {
                    event.preventDefault();
                    closeMenu();
                }
                break;
        }
    });

    menu.addEventListener('toggle', function () {
        if (menu.open) {
            search.value = '';
            filterLanguages();
            var current = menu.querySelector('a[aria-current]');
            if (current) {
                current.scrollIntoView({ block: 'nearest' });
            }
            // Do not pop up the on-screen keyboard on touch devices.
            if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
                search.focus();
            }
        }
    });
})();
