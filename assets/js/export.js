/*
 * Extra export formats that browsers cannot create on their own:
 * PDF, EPS, BMP, GIF and AVIF. Everything runs locally in the browser.
 *
 *   QrExport.encode(format, canvas, { widthPt, heightPt, title }) -> Promise<Blob>
 *
 * - PDF:  hand-written PDF 1.4 with a lossless (Flate) image and an alpha mask
 * - EPS:  hand-written EPS (PostScript level 3) with a lossless image
 * - BMP:  24-bit Windows bitmap
 * - GIF:  gifenc (MIT), loaded on demand
 * - AVIF: jSquash AVIF encoder (Apache-2.0, WebAssembly), loaded on demand
 *
 * The canvas passed in already has the final pixel size; PDF and EPS use
 * widthPt/heightPt (1 pt = 1/72 inch) as the physical size of the code.
 */
(function () {
    'use strict';

    var vendor = new URL('../vendor/', document.currentScript.src).href;
    var encoder = new TextEncoder();

    function unsupported() {
        var error = new Error('Format not supported by this browser');
        error.code = 'unsupported';
        return error;
    }

    function pixels(canvas) {
        return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    }

    /** zlib (RFC 1950) compression = PDF/PostScript FlateDecode. */
    async function deflate(bytes) {
        if (typeof CompressionStream === 'undefined') {
            throw unsupported();
        }
        var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    /** Splits RGBA into RGB and alpha planes. */
    function splitChannels(image) {
        var count = image.width * image.height;
        var rgb = new Uint8Array(count * 3);
        var alpha = new Uint8Array(count);
        var hasAlpha = false;
        for (var i = 0, j = 0; i < count; i++, j += 4) {
            rgb[i * 3] = image.data[j];
            rgb[i * 3 + 1] = image.data[j + 1];
            rgb[i * 3 + 2] = image.data[j + 2];
            alpha[i] = image.data[j + 3];
            if (alpha[i] !== 255) {
                hasAlpha = true;
            }
        }
        return { rgb: rgb, alpha: alpha, hasAlpha: hasAlpha };
    }

    function number(value) {
        return (Math.round(value * 1000) / 1000).toString();
    }

    // ------------------------------------------------------------------
    // PDF
    // ------------------------------------------------------------------

    /** PDF text string as UTF-16BE hex, so any language works in the title. */
    function pdfText(text) {
        var hex = 'FEFF';
        for (var i = 0; i < text.length; i++) {
            hex += ('0000' + text.charCodeAt(i).toString(16)).slice(-4);
        }
        return '<' + hex.toUpperCase() + '>';
    }

    async function pdf(canvas, options) {
        var image = pixels(canvas);
        var channels = splitChannels(image);
        var rgb = await deflate(channels.rgb);
        var mask = channels.hasAlpha ? await deflate(channels.alpha) : null;
        var w = number(options.widthPt);
        var h = number(options.heightPt);

        var parts = [];
        var length = 0;
        var offsets = [];

        function push(chunk) {
            var bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
            parts.push(bytes);
            length += bytes.length;
        }

        function object(id, dictionary, stream) {
            offsets[id] = length;
            push(id + ' 0 obj\n' + dictionary);
            if (stream) {
                push('\nstream\n');
                push(stream);
                push('\nendstream');
            }
            push('\nendobj\n');
        }

        // Header with a binary comment line, as recommended by the PDF spec.
        push('%PDF-1.4\n');
        push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

        var content = encoder.encode('q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im1 Do Q');

        object(1, '<< /Type /Catalog /Pages 2 0 R >>');
        object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
        object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] '
            + '/Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>');
        object(4, '<< /Length ' + content.length + ' >>', content);
        object(5, '<< /Type /XObject /Subtype /Image /Width ' + image.width + ' /Height ' + image.height
            + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ' + rgb.length
            + (mask ? ' /SMask 6 0 R' : '') + ' >>', rgb);
        if (mask) {
            object(6, '<< /Type /XObject /Subtype /Image /Width ' + image.width + ' /Height ' + image.height
                + ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ' + mask.length + ' >>', mask);
        }
        var infoId = mask ? 7 : 6;
        object(infoId, '<< /Title ' + pdfText(options.title || 'QR code') + ' /Producer (QR Code Generator) >>');

        var xref = length;
        var table = 'xref\n0 ' + (infoId + 1) + '\n0000000000 65535 f \n';
        for (var id = 1; id <= infoId; id++) {
            table += ('0000000000' + offsets[id]).slice(-10) + ' 00000 n \n';
        }
        push(table);
        push('trailer\n<< /Size ' + (infoId + 1) + ' /Root 1 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');

        return new Blob(parts, { type: 'application/pdf' });
    }

    // ------------------------------------------------------------------
    // EPS
    // ------------------------------------------------------------------

    /** ASCII85 encoding, wrapped at 75 characters per line. */
    function ascii85(bytes) {
        var out = [];
        var line = '';
        function emit(text) {
            line += text;
            while (line.length >= 75) {
                out.push(line.slice(0, 75));
                line = line.slice(75);
            }
        }
        for (var i = 0; i < bytes.length; i += 4) {
            var remaining = Math.min(4, bytes.length - i);
            var value = 0;
            for (var k = 0; k < 4; k++) {
                value = value * 256 + (k < remaining ? bytes[i + k] : 0);
            }
            if (value === 0 && remaining === 4) {
                emit('z');
                continue;
            }
            var chars = [];
            for (var c = 0; c < 5; c++) {
                chars.unshift(String.fromCharCode(33 + (value % 85)));
                value = Math.floor(value / 85);
            }
            emit(chars.join('').slice(0, remaining + 1));
        }
        out.push(line + '~>');
        return out.join('\n');
    }

    async function eps(canvas, options) {
        var image = pixels(canvas);
        var data = await deflate(splitChannels(image).rgb);
        var w = options.widthPt;
        var h = options.heightPt;
        // DSC comments must stay ASCII.
        var title = String(options.title || 'QR code').replace(/[^\x20-\x7E]/g, '_').replace(/[()\\]/g, '');

        var ps = [
            '%!PS-Adobe-3.0 EPSF-3.0',
            '%%Creator: QR Code Generator',
            '%%Title: (' + title + ')',
            '%%BoundingBox: 0 0 ' + Math.ceil(w) + ' ' + Math.ceil(h),
            '%%HiResBoundingBox: 0 0 ' + number(w) + ' ' + number(h),
            '%%LanguageLevel: 3',
            '%%Pages: 1',
            '%%EndComments',
            '%%Page: 1 1',
            'save',
            number(w) + ' ' + number(h) + ' scale',
            '/DeviceRGB setcolorspace',
            '<< /ImageType 1 /Width ' + image.width + ' /Height ' + image.height + ' /BitsPerComponent 8',
            '   /Decode [0 1 0 1 0 1] /ImageMatrix [' + image.width + ' 0 0 -' + image.height + ' 0 ' + image.height + ']',
            '   /DataSource currentfile /ASCII85Decode filter /FlateDecode filter',
            '>> image',
            ascii85(data),
            'restore',
            'showpage',
            '%%Trailer',
            '%%EOF',
            ''
        ].join('\n');

        return new Blob([ps], { type: 'application/postscript' });
    }

    // ------------------------------------------------------------------
    // BMP
    // ------------------------------------------------------------------

    function bmp(canvas) {
        var image = pixels(canvas);
        var width = image.width;
        var height = image.height;
        var rowSize = Math.ceil(width * 3 / 4) * 4;
        var dataSize = rowSize * height;
        var buffer = new ArrayBuffer(54 + dataSize);
        var view = new DataView(buffer);
        var bytes = new Uint8Array(buffer);

        // BITMAPFILEHEADER
        view.setUint8(0, 0x42); // B
        view.setUint8(1, 0x4D); // M
        view.setUint32(2, 54 + dataSize, true);
        view.setUint32(10, 54, true);
        // BITMAPINFOHEADER
        view.setUint32(14, 40, true);
        view.setInt32(18, width, true);
        view.setInt32(22, height, true); // positive = bottom-up rows
        view.setUint16(26, 1, true);
        view.setUint16(28, 24, true);
        view.setUint32(34, dataSize, true);
        view.setInt32(38, 2835, true); // 72 DPI
        view.setInt32(42, 2835, true);

        for (var y = 0; y < height; y++) {
            var row = 54 + (height - 1 - y) * rowSize;
            for (var x = 0; x < width; x++) {
                var src = (y * width + x) * 4;
                var dst = row + x * 3;
                bytes[dst] = image.data[src + 2];
                bytes[dst + 1] = image.data[src + 1];
                bytes[dst + 2] = image.data[src];
            }
        }
        return new Blob([buffer], { type: 'image/bmp' });
    }

    // ------------------------------------------------------------------
    // GIF (gifenc)
    // ------------------------------------------------------------------

    async function gif(canvas) {
        var lib = await import(vendor + 'gifenc/gifenc.esm.js');
        var image = pixels(canvas);
        var hasAlpha = false;
        for (var i = 3; i < image.data.length; i += 4) {
            if (image.data[i] < 255) {
                hasAlpha = true;
                break;
            }
        }
        var format = hasAlpha ? 'rgba4444' : 'rgb565';
        var palette = lib.quantize(image.data, 256, { format: format, oneBitAlpha: hasAlpha });
        var index = lib.applyPalette(image.data, palette, format);
        var transparentIndex = hasAlpha ? palette.findIndex(function (color) { return color[3] === 0; }) : -1;

        var encoderGif = lib.GIFEncoder();
        encoderGif.writeFrame(index, image.width, image.height, {
            palette: palette,
            transparent: transparentIndex >= 0,
            transparentIndex: Math.max(transparentIndex, 0)
        });
        encoderGif.finish();
        return new Blob([encoderGif.bytes()], { type: 'image/gif' });
    }

    // ------------------------------------------------------------------
    // AVIF (native when the browser supports it, otherwise WebAssembly)
    // ------------------------------------------------------------------

    var avifModule = null;

    function nativeBlob(canvas, type, quality) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (blob) {
                resolve(blob && blob.type === type ? blob : null);
            }, type, quality);
        });
    }

    async function avif(canvas) {
        var native = await nativeBlob(canvas, 'image/avif', 0.9);
        if (native) {
            return native;
        }
        if (typeof WebAssembly === 'undefined') {
            throw unsupported();
        }
        if (!avifModule) {
            avifModule = import(vendor + 'jsquash-avif/avif_enc.js').then(function (lib) {
                return lib.default({ noInitialRun: true });
            });
        }
        var module = await avifModule;
        var image = pixels(canvas);
        var output = module.encode(new Uint8Array(image.data.buffer), image.width, image.height, {
            // Sharp edges matter more than file size for QR codes.
            quality: 90,
            qualityAlpha: -1,
            denoiseLevel: 0,
            tileColsLog2: 0,
            tileRowsLog2: 0,
            speed: 6,
            subsample: 3,
            chromaDeltaQ: false,
            sharpness: 0,
            tune: 0,
            enableSharpYUV: false,
            bitDepth: 8,
            lossless: false
        });
        if (!output) {
            throw new Error('AVIF encoding failed');
        }
        return new Blob([output], { type: 'image/avif' });
    }

    var encoders = { pdf: pdf, eps: eps, bmp: bmp, gif: gif, avif: avif };

    window.QrExport = {
        formats: Object.keys(encoders),
        encode: function (format, canvas, options) {
            var encode = encoders[format];
            if (!encode) {
                return Promise.reject(unsupported());
            }
            return Promise.resolve().then(function () {
                return encode(canvas, options || {});
            });
        }
    };
})();
