/*
 * QR Code Generator - browser logic.
 *
 * Builds the QR payload from the form, renders a live preview with
 * qr-code-styling and handles downloads. Nothing is sent to the server.
 */
(function () {
    'use strict';

    var config = JSON.parse(document.getElementById('app-config').textContent);
    var i18n = config.i18n || {};

    var form = document.getElementById('qr-form');
    var preview = document.getElementById('qr-preview');
    var emptyHint = document.getElementById('qr-empty');
    var message = document.getElementById('qr-message');
    var logoInput = document.getElementById('logo');
    var logoRemove = document.getElementById('logo-remove');

    var logoDataUrl = null;
    var qr = null;
    var renderTimer = null;

    function t(key, params) {
        var text = i18n[key] || key;
        Object.keys(params || {}).forEach(function (name) {
            text = text.split('{' + name + '}').join(String(params[name]));
        });
        return text;
    }

    function value(name) {
        var field = form.elements.namedItem(name);
        if (!field) {
            return '';
        }
        if (field instanceof RadioNodeList) {
            return field.value;
        }
        if (field.type === 'checkbox') {
            return field.checked;
        }
        return typeof field.value === 'string' ? field.value.trim() : '';
    }

    function showMessage(text, kind) {
        if (!text) {
            message.hidden = true;
            message.textContent = '';
            return;
        }
        message.textContent = text;
        message.className = 'notice notice-' + (kind || 'info');
        message.hidden = false;
    }

    // ------------------------------------------------------------------
    // Payload builders for every content type
    // ------------------------------------------------------------------

    /** Escapes special characters in Wi-Fi QR fields (\ ; , : "). */
    function escapeWifi(text) {
        return text.replace(/([\\;,:"])/g, '\\$1');
    }

    /** Escapes special characters in vCard values. */
    function escapeVcard(text) {
        return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    }

    function cleanPhone(text) {
        return text.replace(/[^\d+*#]/g, '');
    }

    var builders = {
        url: function () {
            var url = value('url');
            if (url && !/^[a-z][a-z\d+\-.]*:/i.test(url) && url.indexOf('.') > 0) {
                url = 'https://' + url;
            }
            return url;
        },
        text: function () {
            return value('text');
        },
        email: function () {
            var to = value('email_to');
            if (!to) {
                return '';
            }
            var params = [];
            if (value('email_subject')) {
                params.push('subject=' + encodeURIComponent(value('email_subject')));
            }
            if (value('email_body')) {
                params.push('body=' + encodeURIComponent(value('email_body')));
            }
            return 'mailto:' + to + (params.length ? '?' + params.join('&') : '');
        },
        phone: function () {
            var phone = cleanPhone(value('phone'));
            return phone ? 'tel:' + phone : '';
        },
        sms: function () {
            var phone = cleanPhone(value('sms_phone'));
            return phone ? 'SMSTO:' + phone + ':' + value('sms_message') : '';
        },
        wifi: function () {
            var ssid = value('wifi_ssid');
            if (!ssid) {
                return '';
            }
            var encryption = value('wifi_encryption');
            var payload = 'WIFI:T:' + encryption + ';S:' + escapeWifi(ssid) + ';';
            if (encryption !== 'nopass') {
                payload += 'P:' + escapeWifi(value('wifi_password')) + ';';
            }
            if (value('wifi_hidden')) {
                payload += 'H:true;';
            }
            return payload + ';';
        },
        vcard: function () {
            var first = value('vc_first');
            var last = value('vc_last');
            var org = value('vc_org');
            if (!first && !last && !org) {
                return '';
            }
            var lines = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                'N:' + escapeVcard(last) + ';' + escapeVcard(first) + ';;;',
                'FN:' + escapeVcard((first + ' ' + last).trim() || org)
            ];
            if (org) { lines.push('ORG:' + escapeVcard(org)); }
            if (value('vc_title')) { lines.push('TITLE:' + escapeVcard(value('vc_title'))); }
            if (value('vc_phone')) { lines.push('TEL;TYPE=CELL:' + cleanPhone(value('vc_phone'))); }
            if (value('vc_email')) { lines.push('EMAIL:' + escapeVcard(value('vc_email'))); }
            if (value('vc_url')) { lines.push('URL:' + escapeVcard(value('vc_url'))); }
            if (value('vc_address')) { lines.push('ADR:;;' + escapeVcard(value('vc_address')) + ';;;;'); }
            lines.push('END:VCARD');
            return lines.join('\n');
        },
        geo: function () {
            var lat = parseFloat(value('geo_lat'));
            var lng = parseFloat(value('geo_lng'));
            if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                return '';
            }
            return 'geo:' + lat + ',' + lng;
        }
    };

    // ------------------------------------------------------------------
    // QR options
    // ------------------------------------------------------------------

    function buildOptions(data, overrides) {
        overrides = overrides || {};
        var size = parseInt(value('size'), 10) || 600;
        var dotsColor = value('dots_color');
        var transparent = value('transparent') && !overrides.forceBackground;

        var dotsOptions = { type: value('dots_type'), color: dotsColor };
        if (value('gradient')) {
            dotsOptions.gradient = {
                type: 'linear',
                rotation: Math.PI / 4,
                colorStops: [
                    { offset: 0, color: dotsColor },
                    { offset: 1, color: value('gradient_color') }
                ]
            };
        }

        return {
            type: overrides.type || 'canvas',
            width: size,
            height: size,
            margin: parseInt(value('margin'), 10) || 0,
            data: data,
            image: logoDataUrl || undefined,
            qrOptions: {
                typeNumber: 0,
                mode: 'Byte',
                errorCorrectionLevel: value('error_correction') || 'Q'
            },
            dotsOptions: dotsOptions,
            cornersSquareOptions: { type: value('corner_square_type'), color: value('corner_square_color') },
            cornersDotOptions: { type: value('corner_dot_type'), color: value('corner_dot_color') },
            backgroundOptions: { color: transparent ? 'transparent' : value('background_color') },
            imageOptions: {
                hideBackgroundDots: !!value('logo_hide_dots'),
                imageSize: (parseInt(value('logo_size'), 10) || 30) / 100,
                margin: parseInt(value('logo_margin'), 10) || 0,
                crossOrigin: 'anonymous'
            }
        };
    }

    function currentData() {
        var builder = builders[value('type')] || builders.text;
        return builder();
    }

    function isOverflowError(error) {
        return /overflow|length/i.test(String(error && error.message ? error.message : error));
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    function render() {
        var data = currentData();
        preview.innerHTML = '';
        qr = null;

        if (!data) {
            emptyHint.hidden = false;
            preview.classList.add('is-empty');
            setActionsEnabled(false);
            return;
        }

        emptyHint.hidden = true;
        preview.classList.remove('is-empty');

        try {
            qr = new QRCodeStyling(buildOptions(data));
            qr.append(preview);
            setActionsEnabled(true);
            checkContrast();
            if (message.dataset.source === 'render') {
                showMessage('');
                delete message.dataset.source;
            }
        } catch (error) {
            qr = null;
            preview.innerHTML = '';
            preview.classList.add('is-empty');
            setActionsEnabled(false);
            showMessage(isOverflowError(error) ? t('too_long') : t('generic_error'), 'error');
            message.dataset.source = 'render';
            if (window.console) {
                console.error(error);
            }
        }
    }

    // ------------------------------------------------------------------
    // Contrast check: scanners need dark modules on a light background
    // ------------------------------------------------------------------

    var warning = document.getElementById('qr-warning');

    /** Relative luminance of a #rrggbb color (WCAG 2.x). */
    function luminance(hex) {
        var channels = [1, 3, 5].map(function (i) {
            var c = parseInt(hex.substr(i, 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function contrastRatio(a, b) {
        var la = luminance(a);
        var lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    function checkContrast() {
        var text = '';

        // With a transparent background the final background is unknown.
        if (!value('transparent')) {
            var background = value('background_color');
            var colors = [value('dots_color'), value('corner_square_color'), value('corner_dot_color')];
            if (value('gradient')) {
                colors.push(value('gradient_color'));
            }

            if (luminance(value('dots_color')) > luminance(background)) {
                text = t('inverted');
            } else if (colors.some(function (color) { return contrastRatio(color, background) < 3; })) {
                text = t('low_contrast');
            }
        }

        warning.textContent = text;
        warning.hidden = text === '';
    }

    // ------------------------------------------------------------------
    // Settings are kept in sessionStorage (this browser tab only, never sent
    // anywhere) so they survive a language switch or a page reload.
    // ------------------------------------------------------------------

    var STATE_KEY = 'qr_state';
    var saveTimer = null;
    var extraFields = ['filename', 'format'];

    function storage() {
        try {
            return window.sessionStorage;
        } catch (error) {
            return null;
        }
    }

    function consentGiven() {
        return !window.QrConsent || window.QrConsent.given();
    }

    function collectState() {
        var fields = {};
        Array.prototype.forEach.call(form.elements, function (field) {
            if (!field.name || field.type === 'file' || field.type === 'button') {
                return;
            }
            if (field.type === 'radio') {
                if (field.checked) {
                    fields[field.name] = field.value;
                }
            } else if (field.type === 'checkbox') {
                fields[field.name] = field.checked;
            } else {
                fields[field.name] = field.value;
            }
        });
        return { fields: fields, logo: logoDataUrl, logoName: logoName.title || '' };
    }

    function saveState() {
        window.clearTimeout(saveTimer);
        var store = storage();
        if (!store || !consentGiven()) {
            return;
        }
        var state = collectState();
        try {
            store.setItem(STATE_KEY, JSON.stringify(state));
        } catch (error) {
            // Storage quota exceeded (large logo) - keep everything but the image.
            try {
                state.logo = null;
                state.logoName = '';
                store.setItem(STATE_KEY, JSON.stringify(state));
            } catch (ignored) {
                // Storage unavailable - nothing else to do.
            }
        }
    }

    function scheduleSave() {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(saveState, 300);
    }

    function restoreState() {
        var store = storage();
        var raw = null;
        try {
            raw = store ? store.getItem(STATE_KEY) : null;
        } catch (error) {
            raw = null;
        }
        if (!raw) {
            return;
        }
        var state;
        try {
            state = JSON.parse(raw);
        } catch (error) {
            return;
        }
        Object.keys(state.fields || {}).forEach(function (name) {
            var field = form.elements.namedItem(name);
            var saved = state.fields[name];
            if (!field) {
                return;
            }
            if (field instanceof RadioNodeList) {
                field.value = saved;
            } else if (field.type === 'checkbox') {
                field.checked = !!saved;
            } else if (field.tagName === 'SELECT') {
                // Ignore values that no longer exist.
                if (Array.prototype.some.call(field.options, function (o) { return o.value === saved; })) {
                    field.value = saved;
                }
            } else {
                field.value = saved;
            }
        });
        if (typeof state.logo === 'string' && state.logo.indexOf('data:image/') === 0) {
            logoDataUrl = state.logo;
            setLogoName(state.logoName || '');
        }
    }

    function clearState() {
        var store = storage();
        try {
            if (store) {
                store.removeItem(STATE_KEY);
            }
        } catch (error) {
            // ignore
        }
    }

    function scheduleRender() {
        window.clearTimeout(renderTimer);
        renderTimer = window.setTimeout(render, 120);
    }

    function setActionsEnabled(enabled) {
        ['download', 'copy'].forEach(function (id) {
            document.getElementById(id).disabled = !enabled;
        });
    }

    // ------------------------------------------------------------------
    // UI state helpers
    // ------------------------------------------------------------------

    function updateTypePanels() {
        var type = value('type');
        form.querySelectorAll('.type-panel').forEach(function (panel) {
            panel.hidden = panel.dataset.type !== type;
        });
    }

    function updateConditionalBlocks() {
        document.querySelectorAll('[data-show-if]').forEach(function (block) {
            var key = block.dataset.showIf;
            block.hidden = key === 'logo' ? !logoDataUrl : !value(key);
        });
        logoRemove.hidden = !logoDataUrl;
    }

    function updateOutputs() {
        form.querySelectorAll('output[for]').forEach(function (output) {
            var input = document.getElementById(output.htmlFor.value || output.getAttribute('for'));
            if (input) {
                output.textContent = input.value + (output.dataset.suffix || '');
            }
        });
    }

    function refresh() {
        updateTypePanels();
        updateConditionalBlocks();
        updateOutputs();
        scheduleRender();
        scheduleSave();
    }

    // ------------------------------------------------------------------
    // Center image
    // ------------------------------------------------------------------

    var logoName = document.getElementById('logo-name');

    function setLogoName(name) {
        logoName.textContent = name || logoName.dataset.empty;
        logoName.title = name || '';
    }

    function clearLogo() {
        logoDataUrl = null;
        logoInput.value = '';
        setLogoName('');
        if (message.dataset.source === 'logo') {
            showMessage('');
            delete message.dataset.source;
        }
        refresh();
    }

    logoInput.addEventListener('change', function () {
        var file = logoInput.files && logoInput.files[0];
        if (!file) {
            clearLogo();
            return;
        }
        if (!/^image\//.test(file.type)) {
            clearLogo();
            showMessage(t('logo_invalid'), 'error');
            message.dataset.source = 'logo';
            return;
        }
        if (file.size > config.maxLogoSizeMb * 1024 * 1024) {
            clearLogo();
            showMessage(t('logo_too_big', { size: config.maxLogoSizeMb }), 'error');
            message.dataset.source = 'logo';
            return;
        }

        var reader = new FileReader();
        reader.onload = function () {
            logoDataUrl = String(reader.result);
            setLogoName(file.name);
            // A logo hides part of the code, so the highest error correction
            // level gives the best chance of the code staying readable.
            var ec = form.elements.namedItem('error_correction');
            if (ec.value !== 'H') {
                ec.value = 'H';
                showMessage(t('logo_ec_hint'), 'info');
                message.dataset.source = 'logo';
            }
            refresh();
        };
        reader.onerror = function () {
            clearLogo();
            showMessage(t('logo_invalid'), 'error');
        };
        reader.readAsDataURL(file);
    });

    logoRemove.addEventListener('click', clearLogo);

    // ------------------------------------------------------------------
    // Download / copy / reset
    // ------------------------------------------------------------------

    function safeFilename() {
        var name = value('filename').replace(/[\\/:*?"<>|]+/g, '').trim();
        return name || 'qr-code';
    }

    document.getElementById('download').addEventListener('click', function () {
        var data = currentData();
        if (!data) {
            return;
        }
        var format = value('format') || 'png';
        try {
            var exporter = new QRCodeStyling(buildOptions(data, {
                type: format === 'svg' ? 'svg' : 'canvas',
                // JPEG has no alpha channel, so fall back to the background color.
                forceBackground: format === 'jpeg'
            }));
            exporter.download({ name: safeFilename(), extension: format });
        } catch (error) {
            showMessage(t('generic_error'), 'error');
        }
    });

    document.getElementById('copy').addEventListener('click', function () {
        if (!qr || !navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
            showMessage(t('copy_failed'), 'error');
            return;
        }
        // Pass a promise so Safari keeps the user gesture.
        var blob = qr.getRawData('png');
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(function () { showMessage(t('copied'), 'success'); })
            .catch(function () { showMessage(t('copy_failed'), 'error'); });
    });

    document.getElementById('reset').addEventListener('click', function () {
        form.reset();
        logoDataUrl = null;
        setLogoName('');
        showMessage('');
        clearState();
        refresh();
    });

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    form.addEventListener('input', function (event) {
        if (event.target !== logoInput) {
            refresh();
        }
    });
    form.addEventListener('change', function (event) {
        if (event.target !== logoInput) {
            refresh();
        }
    });
    form.addEventListener('submit', function (event) {
        event.preventDefault();
    });

    // File name and format live outside the <form> element in the DOM.
    extraFields.forEach(function (id) {
        document.getElementById(id).addEventListener('input', scheduleSave);
        document.getElementById(id).addEventListener('change', scheduleSave);
    });

    // Save right away when the page is left (e.g. switching the language).
    window.addEventListener('pagehide', saveState);
    document.addEventListener('qr:consent', saveState);

    restoreState();
    refresh();
})();
