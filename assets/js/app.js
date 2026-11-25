/*
 * QR Code Generator - browser logic.
 *
 * Builds the QR payload from the form, renders a live preview with
 * qr-code-styling and handles downloads. Nothing is sent to the server.
 */
(function () {
    'use strict';

    var config = JSON.parse(document.getElementById('app-config').textContent);
    // jsQR is loaded on demand, relative to this script (works in sub-folders).
    var JSQR_URL = new URL('../vendor/jsqr/jsQR.js', document.currentScript.src).href;
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

    /** Escapes special characters in MeCard values (\ ; ,). */
    function escapeMecard(text) {
        return text.replace(/([\\;,])/g, '\\$1');
    }

    /** vCard 3.0: understood by every phone. */
    function buildVcard(first, last, org) {
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
    }

    /** MeCard: a shorter contact format, so the code has fewer dots. */
    function buildMecard(first, last, org) {
        // "N:Last,First" - the comma separates the two names.
        var name = last && first ? escapeMecard(last) + ',' + escapeMecard(first) : escapeMecard(last || first || org);
        var parts = ['N:' + name];
        if (org) { parts.push('ORG:' + escapeMecard(org)); }
        if (value('vc_phone')) { parts.push('TEL:' + cleanPhone(value('vc_phone'))); }
        if (value('vc_email')) { parts.push('EMAIL:' + escapeMecard(value('vc_email'))); }
        if (value('vc_url')) { parts.push('URL:' + escapeMecard(value('vc_url'))); }
        if (value('vc_address')) { parts.push('ADR:' + escapeMecard(value('vc_address'))); }
        // MeCard has no job title field - it goes into the note.
        if (value('vc_title')) { parts.push('NOTE:' + escapeMecard(value('vc_title'))); }
        return 'MECARD:' + parts.join(';') + ';;';
    }

    /**
     * "2026-11-20T15:30" (datetime-local input) -> "20261120T153000".
     * Local ("floating") time, so the event shows at the same clock time
     * in the scanning phone's calendar.
     */
    function icalDate(text) {
        var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text || '');
        return match ? match[1] + match[2] + match[3] + 'T' + match[4] + match[5] + '00' : '';
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
            return value('vc_format') === 'mecard' ? buildMecard(first, last, org) : buildVcard(first, last, org);
        },
        whatsapp: function () {
            // wa.me needs the full international number, digits only.
            var digits = value('wa_phone').replace(/\D/g, '');
            if (!digits) {
                return '';
            }
            var message = value('wa_message');
            return 'https://wa.me/' + digits + (message ? '?text=' + encodeURIComponent(message) : '');
        },
        app: function () {
            var id = value('app_id').replace(/\s+/g, '');
            if (!id) {
                return '';
            }
            // A full store link is used as it is.
            if (/^https?:\/\//i.test(id)) {
                return id;
            }
            if (value('app_store') === 'google') {
                return /^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+$/.test(id)
                    ? 'https://play.google.com/store/apps/details?id=' + id
                    : '';
            }
            var match = /^(?:id)?(\d{5,})$/i.exec(id);
            return match ? 'https://apps.apple.com/app/id' + match[1] : '';
        },
        event: function () {
            var title = value('ev_title');
            var start = icalDate(value('ev_start'));
            if (!title || !start) {
                return '';
            }
            var end = icalDate(value('ev_end'));
            var lines = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'BEGIN:VEVENT',
                'SUMMARY:' + escapeVcard(title),
                'DTSTART:' + start
            ];
            if (end && end > start) { lines.push('DTEND:' + end); }
            if (value('ev_location')) { lines.push('LOCATION:' + escapeVcard(value('ev_location'))); }
            if (value('ev_description')) { lines.push('DESCRIPTION:' + escapeVcard(value('ev_description'))); }
            lines.push('END:VEVENT', 'END:VCALENDAR');
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

    /**
     * The QR library writes each character as a single byte (char code & 0xFF),
     * which breaks letters such as "ż", Cyrillic or Chinese. Passing the UTF-8
     * bytes as a "binary string" (one character per byte) makes the code
     * contain proper UTF-8, which phone scanners decode correctly.
     */
    function utf8ByteString(text) {
        var bytes = new TextEncoder().encode(text);
        var out = '';
        for (var i = 0; i < bytes.length; i += 8192) {
            out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        return out;
    }

    function buildOptions(data, overrides) {
        overrides = overrides || {};
        // "scale" renders a larger image with the same proportions (print formats).
        var scale = overrides.scale || 1;
        var size = Math.round((parseInt(value('size'), 10) || 600) * scale);
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
            margin: Math.round((parseInt(value('margin'), 10) || 0) * scale),
            data: utf8ByteString(data),
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
                margin: Math.round((parseInt(value('logo_margin'), 10) || 0) * scale),
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
            hideScan();
            return;
        }

        emptyHint.hidden = true;
        preview.classList.remove('is-empty');

        try {
            qr = new QRCodeStyling(buildOptions(data));
            qr.append(preview);
            setActionsEnabled(true);
            checkContrast();
            scheduleScan(data);
            if (message.dataset.source === 'render') {
                showMessage('');
                delete message.dataset.source;
            }
        } catch (error) {
            qr = null;
            preview.innerHTML = '';
            preview.classList.add('is-empty');
            setActionsEnabled(false);
            hideScan();
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
    var extraFields = ['filename', 'format', 'print_size', 'print_unit', 'print_dpi'];

    function storage() {
        try {
            return window.sessionStorage;
        } catch (error) {
            return null;
        }
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
        if (!store) {
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
        applyFields(state.fields || {});
        if (typeof state.logo === 'string' && state.logo.indexOf('data:image/') === 0) {
            logoDataUrl = state.logo;
            setLogoName(state.logoName || '');
        }
    }

    /** Puts saved values back into the form. */
    function applyFields(fields) {
        Object.keys(fields).forEach(function (name) {
            var field = form.elements.namedItem(name);
            var saved = fields[name];
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
        ['download', 'copy', 'copy-svg', 'print', 'share'].forEach(function (id) {
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
        scheduleHistory();
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

    /** Reads an image file (chosen, dropped or pasted) into a data URL - locally. */
    function loadLogoFile(file) {
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
    }

    logoInput.addEventListener('change', function () {
        loadLogoFile(logoInput.files && logoInput.files[0]);
    });

    logoRemove.addEventListener('click', clearLogo);

    // Drag and drop an image onto the "Center image" card.
    var logoCard = document.getElementById('logo-card');
    var dragDepth = 0;

    function hasFiles(event) {
        return !!event.dataTransfer && Array.prototype.indexOf.call(event.dataTransfer.types || [], 'Files') !== -1;
    }

    function firstImage(files) {
        return Array.prototype.filter.call(files || [], function (file) {
            return /^image\//.test(file.type);
        })[0] || (files && files[0]) || null;
    }

    logoCard.addEventListener('dragenter', function (event) {
        if (hasFiles(event)) {
            dragDepth++;
            logoCard.classList.add('is-dragover');
        }
    });
    logoCard.addEventListener('dragleave', function (event) {
        if (hasFiles(event) && --dragDepth <= 0) {
            dragDepth = 0;
            logoCard.classList.remove('is-dragover');
        }
    });
    logoCard.addEventListener('drop', function (event) {
        dragDepth = 0;
        logoCard.classList.remove('is-dragover');
        if (hasFiles(event)) {
            event.preventDefault();
            event.stopPropagation();
            logoInput.value = '';
            loadLogoFile(firstImage(event.dataTransfer.files));
        }
    });
    // Elsewhere on the page a dropped file must not replace the page.
    window.addEventListener('dragover', function (event) {
        if (hasFiles(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = logoCard.contains(event.target) ? 'copy' : 'none';
        }
    });
    window.addEventListener('drop', function (event) {
        if (hasFiles(event)) {
            event.preventDefault();
        }
    });

    // Paste an image (e.g. a screenshot) with Ctrl+V / Cmd+V.
    document.addEventListener('paste', function (event) {
        var data = event.clipboardData;
        if (!data || document.querySelector('dialog[open]')) {
            return;
        }
        var image = Array.prototype.filter.call(data.files || [], function (file) {
            return /^image\//.test(file.type);
        })[0];
        if (!image) {
            return;
        }
        // In a text field, pasted text wins (some apps copy text and an image).
        var target = event.target;
        var typing = target && (target.tagName === 'TEXTAREA'
            || (target.tagName === 'INPUT' && /^(text|url|email|tel|search|number|password)$/.test(target.type)));
        if (typing && data.getData('text/plain')) {
            return;
        }
        event.preventDefault();
        logoInput.value = '';
        loadLogoFile(image);
    });

    // ------------------------------------------------------------------
    // Download / copy / reset
    // ------------------------------------------------------------------

    function safeFilename() {
        var name = value('filename').replace(/[\\/:*?"<>|]+/g, '').trim();
        return name || 'qr-code';
    }

    // Formats the QR library saves by itself.
    var NATIVE_FORMATS = { png: true, jpeg: true, webp: true, svg: true };
    // Formats without transparency: the background color is filled in.
    var OPAQUE_FORMATS = { jpeg: true, bmp: true, eps: true };
    // Print formats are rendered at up to 3x resolution (about 300 DPI).
    var PRINT_FORMATS = { pdf: true, eps: true };
    var EXTENSIONS = { jpeg: 'jpg' };
    // Largest image rendered for print (browsers limit canvas sizes).
    var MAX_PRINT_PX = 6000;
    var UNIT_PER_INCH = { mm: 25.4, cm: 2.54, in: 1 };

    /** The chosen print size in inches, or 0 when the field is empty. */
    function printInches() {
        var amount = parseFloat(String(value('print_size')).replace(',', '.'));
        var perInch = UNIT_PER_INCH[value('print_unit')] || 2.54;
        return isFinite(amount) && amount > 0 ? Math.min(100, amount / perInch) : 0;
    }

    /**
     * Resolution and physical size for PDF, EPS and printing.
     * With a print size: that size at the chosen DPI. Without one: the pixel
     * size at 96 DPI (1 px = 0.75 pt), rendered at `fallbackScale`.
     */
    function printLayout(fallbackScale) {
        var size = parseInt(value('size'), 10) || 600;
        var inches = printInches();
        if (!inches) {
            return { scale: Math.min(fallbackScale, 4096 / size), widthPt: size * 0.75, cssWidth: size + 'px' };
        }
        var dpi = parseInt(value('print_dpi'), 10) || 300;
        var pixels = Math.max(64, Math.min(MAX_PRINT_PX, Math.round(inches * dpi)));
        return { scale: pixels / size, widthPt: inches * 72, cssWidth: inches + 'in' };
    }

    /** Renders the current code into a canvas (for the custom exporters). */
    async function renderCanvas(data, overrides) {
        var exporter = new QRCodeStyling(buildOptions(data, overrides));
        var blob = await exporter.getRawData('png');
        var bitmap = await createImageBitmap(blob);
        var canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        return canvas;
    }

    function saveBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }

    /** Disables a button and shows "Preparing file…" while a promise runs. */
    async function busy(button, task) {
        var label = button.textContent;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = t('exporting');
        try {
            return await task();
        } finally {
            button.textContent = label;
            button.removeAttribute('aria-busy');
            button.disabled = !qr;
        }
    }

    function exportError(error) {
        if (window.console) {
            console.error(error);
        }
        showMessage(error && error.code === 'unsupported' ? t('format_unsupported') : t('generic_error'), 'error');
    }

    var downloadButton = document.getElementById('download');

    downloadButton.addEventListener('click', function () {
        var data = currentData();
        if (!data) {
            return;
        }
        var format = value('format') || 'png';

        if (NATIVE_FORMATS[format]) {
            try {
                var exporter = new QRCodeStyling(buildOptions(data, {
                    type: format === 'svg' ? 'svg' : 'canvas',
                    forceBackground: !!OPAQUE_FORMATS[format]
                }));
                exporter.download({ name: safeFilename(), extension: format });
            } catch (error) {
                exportError(error);
            }
            return;
        }

        var size = parseInt(value('size'), 10) || 600;
        // Print formats: the print size at its DPI, or about 300 DPI by default.
        var layout = PRINT_FORMATS[format] ? printLayout(3) : { scale: 1, widthPt: size * 0.75 };

        busy(downloadButton, async function () {
            var canvas = await renderCanvas(data, { forceBackground: !!OPAQUE_FORMATS[format], scale: layout.scale });
            var blob = await window.QrExport.encode(format, canvas, {
                widthPt: layout.widthPt,
                heightPt: layout.widthPt,
                title: safeFilename()
            });
            saveBlob(blob, safeFilename() + '.' + (EXTENSIONS[format] || format));
        }).catch(exportError);
    });

    // ------------------------------------------------------------------
    // Copy SVG code
    // ------------------------------------------------------------------

    document.getElementById('copy-svg').addEventListener('click', function () {
        var data = currentData();
        if (!data) {
            return;
        }
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            showMessage(t('clipboard_failed'), 'error');
            return;
        }
        new QRCodeStyling(buildOptions(data, { type: 'svg' })).getRawData('svg')
            .then(function (blob) { return blob.text(); })
            .then(function (svg) { return navigator.clipboard.writeText(svg); })
            .then(function () { showMessage(t('svg_copied'), 'success'); })
            .catch(function () { showMessage(t('clipboard_failed'), 'error'); });
    });

    // ------------------------------------------------------------------
    // Print: only the code is printed, at the chosen size (96 px = 1 inch)
    // ------------------------------------------------------------------

    var printArea = document.getElementById('print-area');
    var printUrl = null;

    document.getElementById('print').addEventListener('click', function () {
        var data = currentData();
        if (!data) {
            return;
        }
        // Without a print size, twice the resolution keeps the edges sharp on paper.
        var layout = printLayout(2);
        new QRCodeStyling(buildOptions(data, { scale: layout.scale })).getRawData('png')
            .then(function (blob) {
                if (printUrl) {
                    URL.revokeObjectURL(printUrl);
                }
                printUrl = URL.createObjectURL(blob);
                var image = new Image();
                image.alt = '';
                image.style.width = layout.cssWidth;
                image.onload = function () {
                    window.print();
                };
                image.src = printUrl;
                printArea.replaceChildren(image);
            })
            .catch(exportError);
    });

    // ------------------------------------------------------------------
    // Share (phones and some desktop browsers): shares a PNG file
    // ------------------------------------------------------------------

    var shareButton = document.getElementById('share');

    function canShareFiles() {
        try {
            return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
                && navigator.canShare({ files: [new File([''], 'qr.png', { type: 'image/png' })] });
        } catch (error) {
            return false;
        }
    }

    shareButton.hidden = !canShareFiles();

    shareButton.addEventListener('click', function () {
        if (!qr) {
            return;
        }
        // Pass the file promise straight away so the browser keeps the user gesture.
        qr.getRawData('png')
            .then(function (blob) {
                var file = new File([blob], safeFilename() + '.png', { type: 'image/png' });
                return navigator.share({ files: [file], title: document.title });
            })
            .catch(function (error) {
                // The visitor closed the share sheet - not an error.
                if (error && error.name === 'AbortError') {
                    return;
                }
                showMessage(t('share_failed'), 'error');
            });
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
    // Readability check: the rendered code is decoded with jsQR in the
    // browser, the same way a phone camera app would read it.
    // ------------------------------------------------------------------

    var scanStatus = document.getElementById('qr-scan');
    var scanTimer = null;
    var scanToken = 0;
    var jsqrPromise = null;

    function loadJsQR() {
        if (!jsqrPromise) {
            jsqrPromise = new Promise(function (resolve, reject) {
                var script = document.createElement('script');
                script.src = JSQR_URL;
                script.onload = function () { resolve(window.jsQR); };
                script.onerror = function () {
                    jsqrPromise = null;
                    reject(new Error('jsQR could not be loaded'));
                };
                document.head.appendChild(script);
            });
        }
        return jsqrPromise;
    }

    function setScan(state, text) {
        scanStatus.className = 'scan-status is-' + state;
        scanStatus.textContent = text;
        scanStatus.hidden = false;
    }

    function hideScan() {
        window.clearTimeout(scanTimer);
        scanToken++;
        scanStatus.hidden = true;
    }

    function sameBytes(a, b) {
        if (!a || a.length !== b.length) {
            return false;
        }
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    function scheduleScan(data) {
        window.clearTimeout(scanTimer);
        var token = ++scanToken;
        setScan('checking', t('scan_checking'));
        scanTimer = window.setTimeout(function () {
            runScan(data, token);
        }, 400);
    }

    async function runScan(data, token) {
        var current = qr;
        try {
            var jsQR = await loadJsQR();
            if (!current || token !== scanToken) {
                return;
            }
            // Waits until the preview (including the logo) is fully drawn.
            var bitmap = await createImageBitmap(await current.getRawData('png'));
            // Decoding a smaller copy is faster and closer to a phone camera.
            var scale = Math.min(1, 800 / bitmap.width);
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            var context = canvas.getContext('2d');
            // Transparent codes are checked on white paper.
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            var image = context.getImageData(0, 0, canvas.width, canvas.height);
            // Many phone scanners cannot read inverted codes, so neither do we.
            var result = jsQR(image.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            if (token !== scanToken) {
                return;
            }
            var readable = !!result && (result.data === data
                || sameBytes(result.binaryData, new TextEncoder().encode(data)));
            setScan(readable ? 'ok' : 'fail', readable ? t('scan_ok') : t('scan_fail'));
        } catch (error) {
            if (token === scanToken) {
                scanStatus.hidden = true;
            }
        }
    }

    // ------------------------------------------------------------------
    // Saved styles: the look of the code (not its content) is stored under
    // a name in localStorage - only in this browser.
    // ------------------------------------------------------------------

    var PRESETS_KEY = 'qr_presets';
    var STYLE_FIELDS = [
        'dots_type', 'dots_color', 'gradient', 'gradient_color',
        'corner_square_type', 'corner_square_color', 'corner_dot_type', 'corner_dot_color',
        'background_color', 'transparent', 'size', 'margin', 'error_correction',
        'logo_size', 'logo_margin', 'logo_hide_dots',
        'print_size', 'print_unit', 'print_dpi'
    ];

    /** The current values of the style fields only (no content). */
    function styleFields() {
        var fields = {};
        var all = collectState().fields;
        STYLE_FIELDS.forEach(function (key) {
            if (key in all) {
                fields[key] = all[key];
            }
        });
        return fields;
    }
    var presetSelect = document.getElementById('preset-select');
    var presetName = document.getElementById('preset-name');
    var presetSave = document.getElementById('preset-save');
    var presetDelete = document.getElementById('preset-delete');

    function readPresets() {
        try {
            var presets = JSON.parse(window.localStorage.getItem(PRESETS_KEY) || '{}');
            return presets && typeof presets === 'object' ? presets : {};
        } catch (error) {
            return {};
        }
    }

    function writePresets(presets) {
        // Throws when storage is full or blocked - handled by the caller.
        window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    }

    function renderPresets(selected) {
        var presets = readPresets();
        var placeholder = presetSelect.options[0];
        presetSelect.replaceChildren(placeholder);
        Object.keys(presets).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (name) {
            var option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            presetSelect.appendChild(option);
        });
        presetSelect.value = selected && presets[selected] ? selected : '';
        presetDelete.disabled = !presetSelect.value;
    }

    presetName.addEventListener('input', function () {
        presetSave.disabled = presetName.value.trim() === '';
    });

    presetName.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            presetSave.click();
        }
    });

    presetSave.addEventListener('click', function () {
        var name = presetName.value.trim();
        if (!name) {
            return;
        }
        var presets = readPresets();
        presets[name] = { fields: styleFields(), logo: logoDataUrl, logoName: logoName.title || '' };
        try {
            writePresets(presets);
            showMessage(t('preset_saved', { name: name }), 'success');
        } catch (error) {
            // Not enough space for the image - keep the rest of the style.
            presets[name].logo = null;
            presets[name].logoName = '';
            try {
                writePresets(presets);
                showMessage(t('preset_saved_no_logo', { name: name }), 'info');
            } catch (ignored) {
                showMessage(t('generic_error'), 'error');
                return;
            }
        }
        renderPresets(name);
    });

    presetSelect.addEventListener('change', function () {
        var name = presetSelect.value;
        presetDelete.disabled = !name;
        var preset = readPresets()[name];
        if (!preset) {
            return;
        }
        applyFields(preset.fields || {});
        // A style includes its center image (or the lack of one).
        var hasLogo = typeof preset.logo === 'string' && preset.logo.indexOf('data:image/') === 0;
        logoDataUrl = hasLogo ? preset.logo : null;
        logoInput.value = '';
        setLogoName(hasLogo ? preset.logoName : '');
        presetName.value = name;
        presetSave.disabled = false;
        refresh();
    });

    presetDelete.addEventListener('click', function () {
        var name = presetSelect.value;
        if (!name) {
            return;
        }
        var presets = readPresets();
        delete presets[name];
        try {
            writePresets(presets);
        } catch (error) {
            showMessage(t('generic_error'), 'error');
            return;
        }
        if (presetName.value.trim() === name) {
            presetName.value = '';
            presetSave.disabled = true;
        }
        renderPresets('');
        showMessage(t('preset_deleted', { name: name }), 'info');
    });

    renderPresets('');

    // ------------------------------------------------------------------
    // Style link: the style (no content, no image) is put after "#" in the
    // address. Browsers never send that part to a server.
    // ------------------------------------------------------------------

    var STYLE_HASH = /^#style=([A-Za-z0-9_-]{1,4000})$/;

    function encodeStyle(fields) {
        return btoa(utf8ByteString(JSON.stringify(fields)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function decodeStyle(text) {
        var binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
        var bytes = Uint8Array.from(binary, function (c) { return c.charCodeAt(0); });
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    /** Keeps only known style fields with sensible values. */
    function cleanStyle(data) {
        var fields = {};
        if (!data || typeof data !== 'object') {
            return fields;
        }
        STYLE_FIELDS.forEach(function (key) {
            var saved = data[key];
            var field = form.elements.namedItem(key);
            if (!field || saved === undefined) {
                return;
            }
            if (field.type === 'checkbox') {
                fields[key] = saved === true;
            } else if (typeof saved === 'string' && saved.length <= 20) {
                if (field.type === 'color' && !/^#[0-9a-f]{6}$/i.test(saved)) {
                    return;
                }
                if ((field.type === 'range' || field.type === 'number') && !/^(\d+(\.\d+)?)?$/.test(saved)) {
                    return;
                }
                fields[key] = saved;
            }
        });
        return fields;
    }

    function applyStyleLink() {
        var match = STYLE_HASH.exec(window.location.hash);
        if (!match) {
            return;
        }
        // The style is applied once; the address goes back to normal.
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        var fields;
        try {
            fields = cleanStyle(decodeStyle(match[1]));
        } catch (error) {
            return;
        }
        if (!Object.keys(fields).length) {
            return;
        }
        applyFields(fields);
        refresh();
        showMessage(t('style_from_link'), 'success');
    }

    document.getElementById('preset-link').addEventListener('click', function () {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            showMessage(t('clipboard_failed'), 'error');
            return;
        }
        var link = window.location.href.split('#')[0] + '#style=' + encodeStyle(styleFields());
        navigator.clipboard.writeText(link)
            .then(function () { showMessage(t('link_copied'), 'success'); })
            .catch(function () { showMessage(t('clipboard_failed'), 'error'); });
    });

    window.addEventListener('hashchange', applyStyleLink);

    // ------------------------------------------------------------------
    // Undo / redo (buttons and Ctrl+Z / Ctrl+Y). Only in memory.
    // ------------------------------------------------------------------

    var HISTORY_LIMIT = 100;
    var undoButton = document.getElementById('undo');
    var redoButton = document.getElementById('redo');
    var historyStack = [];
    var historyIndex = -1;
    var historyTimer = null;
    var applyingHistory = false;

    function updateHistoryButtons() {
        undoButton.disabled = historyIndex <= 0;
        redoButton.disabled = historyIndex >= historyStack.length - 1;
    }

    function recordHistory() {
        window.clearTimeout(historyTimer);
        historyTimer = null;
        var state = collectState();
        var key = JSON.stringify(state.fields);
        var current = historyStack[historyIndex];
        if (current && current.key === key && current.state.logo === state.logo) {
            return;
        }
        // A new change removes the steps that were undone.
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push({ key: key, state: state });
        if (historyStack.length > HISTORY_LIMIT) {
            historyStack.shift();
        }
        historyIndex = historyStack.length - 1;
        updateHistoryButtons();
    }

    function scheduleHistory() {
        if (applyingHistory) {
            return;
        }
        window.clearTimeout(historyTimer);
        // Typing is grouped into one step.
        historyTimer = window.setTimeout(recordHistory, 500);
    }

    function goHistory(step) {
        if (historyTimer) {
            recordHistory();
        }
        var target = historyIndex + step;
        if (target < 0 || target >= historyStack.length) {
            return;
        }
        historyIndex = target;
        var state = historyStack[target].state;
        applyingHistory = true;
        try {
            applyFields(state.fields);
            logoDataUrl = state.logo || null;
            logoInput.value = '';
            setLogoName(state.logo ? state.logoName : '');
            refresh();
        } finally {
            applyingHistory = false;
        }
        updateHistoryButtons();
    }

    undoButton.addEventListener('click', function () { goHistory(-1); });
    redoButton.addEventListener('click', function () { goHistory(1); });

    document.addEventListener('keydown', function (event) {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || document.querySelector('dialog[open]')) {
            return;
        }
        var key = event.key.toLowerCase();
        var redo = key === 'y' || (key === 'z' && event.shiftKey);
        if (key !== 'z' && key !== 'y') {
            return;
        }
        // Text fields keep their own undo for typing.
        var target = event.target;
        if (target && (target.isContentEditable || target.tagName === 'TEXTAREA'
            || (target.tagName === 'INPUT' && /^(text|url|email|tel|search|number|password)$/.test(target.type)))) {
            return;
        }
        event.preventDefault();
        goHistory(redo ? 1 : -1);
    });

    // ------------------------------------------------------------------
    // Offline support: a service worker keeps a copy of the site's own files.
    // ------------------------------------------------------------------

    function registerServiceWorker() {
        if (!config.serviceWorker || !('serviceWorker' in navigator) || !window.isSecureContext) {
            return;
        }
        navigator.serviceWorker.register(config.serviceWorker).catch(function (error) {
            if (window.console) {
                console.warn('Offline mode is not available:', error);
            }
        });
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    /** Controls that are not QR settings (e.g. saved styles) do not re-render. */
    function isSetting(target) {
        return target !== logoInput && !(target.closest && target.closest('[data-ignore]'));
    }

    form.addEventListener('input', function (event) {
        if (isSetting(event.target)) {
            refresh();
        }
    });
    form.addEventListener('change', function (event) {
        if (isSetting(event.target)) {
            refresh();
        }
    });
    form.addEventListener('submit', function (event) {
        event.preventDefault();
    });

    // File name and format live outside the <form> element in the DOM.
    extraFields.forEach(function (id) {
        ['input', 'change'].forEach(function (type) {
            document.getElementById(id).addEventListener(type, function () {
                scheduleSave();
                scheduleHistory();
            });
        });
    });

    // Save right away when the page is left (e.g. switching the language).
    window.addEventListener('pagehide', saveState);

    restoreState();
    refresh();
    applyStyleLink();
    recordHistory();

    // Offline mode: keeps a copy of the site's own files in the browser.
    registerServiceWorker();
})();
