# QR Code Generator

A simple, dependency-free PHP web application for creating styled QR codes.

**Live demo:** <https://pascold.github.io/QRCode-WebApp/> (static version on GitHub Pages)

- Generate QR codes for **links, plain text, e-mail, phone numbers, SMS, Wi-Fi networks, contact cards (vCard) and map locations**.
- Customize the look: **dot style** (square, dots, rounded, extra rounded, classy, classy rounded), **corner styles**, colors, optional **gradient**, transparent background, size, margin and error correction level.
- Place your own **image / logo in the center** of the code.
- Live preview and export to **PNG, SVG, PDF, JPG, WebP, AVIF, GIF, BMP and EPS**, plus **Print**, **Share** (phones), **Copy image** and **Copy SVG code**.
- **92 languages and regional variants** (BCP 47 locale codes such as `pl`, `en-GB`, `sr-Latn`, `zh-HK`) in a searchable dropdown with flags, including right-to-left support for Arabic, Hebrew, Persian and Urdu. Adding more takes one file.
- **Light and dark theme**, following the operating system by default, with a toggle in the header.
- **Private by design:** content and images are processed entirely in the browser and never uploaded to the server. Your current settings (including the center image) survive a language switch or reload thanks to `sessionStorage` in your own browser tab.
- **Contrast check:** a warning appears when the dots are too light or lighter than the background (inverted codes), which many phones cannot scan.
- **Consent dialog** on the first visit: preferences are stored only after the visitor accepts; declining explains that the page cannot be used and offers to close it.
- **Installable** on phones and desktops (web app manifest and icons).
- Searchable language dropdown with **keyboard navigation** (arrows, Home/End, Enter, Escape).

## Requirements

| Environment | Version |
|-------------|---------|
| PHP         | 8.2 or newer (tested on 8.2, compatible with 8.5) |
| Web server  | Apache (e.g. XAMPP), Nginx + PHP-FPM, or PHP's built-in server |
| Browser     | Any modern browser (Chrome, Edge, Firefox, Safari) |

No database, no Composer, no build step and no PHP extensions beyond the defaults are required.

## Installation

### Local - XAMPP (Windows / macOS / Linux)

1. Copy the project folder into XAMPP's `htdocs` directory, e.g. `C:\xampp\htdocs\QRCode-WebApp`.
2. Start **Apache** in the XAMPP Control Panel.
3. Open <http://localhost/QRCode-WebApp/> in your browser.

The project can live in any sub-folder; all paths are relative.

### Local - PHP built-in server

```bash
php -S localhost:8000
```

Then open <http://localhost:8000>.

### Production server

1. Upload all files to the web root (or a sub-folder) of your server running PHP 8.2+ (e.g. PHP 8.5).
2. **Apache:** the included `.htaccess` files block access to internal folders (`src/`, `lang/`, `templates/`) and `config.php`. Make sure `AllowOverride All` (or at least `FileInfo Indexes Limit`) is enabled.
3. **Nginx:** add an equivalent rule, for example:

   ```nginx
   location ~ ^/(src|lang|templates)/ { deny all; }
   location = /config.php { deny all; }
   location ~ /\. { deny all; }
   ```

4. Serve the site over **HTTPS** - the "Copy image" button relies on the Clipboard API, which browsers only enable in secure contexts (`https://` or `localhost`).

### GitHub Pages (static version)

GitHub Pages cannot run PHP, so the repository includes a build script that renders a static copy of the app - one page per language:

| URL | Content |
|-----|---------|
| `/` | Start page - opens the saved language, or the best match for the browser languages |
| `/pl/`, `/en-GB/`, `/sr-Latn/`, … | The app in that language (92 pages) |
| `/404.html` | Fixes the letter case of language URLs (`/en-gb/` → `/en-GB/`), anything else goes to the start page |

The live version is published automatically by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`:

1. One-time setup: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the workflow manually from the **Actions** tab).
3. The site appears at `https://<user>.github.io/<repository>/` - for this repository <https://pascold.github.io/QRCode-WebApp/>.

The workflow also checks all translations and lints the PHP files before deploying.

To build it locally:

```bash
php tools/build-static.php --out=dist --base=/
```

`--base` is the URL path the site is served from (`/<repository>/` for a GitHub Pages project site, `/` for a custom domain). The `dist/` folder is ignored by Git.

Differences from the PHP version:

| | PHP server | Static (GitHub Pages) |
|---|---|---|
| Language URLs | `?lang=pl` | `/pl/` |
| Preferences (consent, language, theme) | cookies | `localStorage` |
| Browser language detection | `Accept-Language` header | `navigator.languages` on the start page |
| Security headers | HTTP headers | `<meta>` Content-Security-Policy and referrer policy |

The `.htaccess` files stay in the repository for anyone who downloads the project and runs the PHP version on Apache.

## Configuration

All settings live in [`config.php`](config.php):

| Key | Description | Default |
|-----|-------------|---------|
| `default_language` | Fallback locale code | `en` |
| `language_dir` | Folder with translation files | `lang/` |
| `language_cookie` | Cookie that remembers the chosen language | `qr_lang` |
| `language_cookie_lifetime` | Cookie lifetime in seconds | 1 year |
| `theme_cookie` | Cookie that remembers the light/dark theme | `qr_theme` |
| `consent_cookie` | Cookie that remembers the visitor's consent | `qr_consent` |
| `author_name`, `author_url` | Author credited in the footer | `Pascold` |
| `repository_url`, `license_url` | Footer links to the source code and license | GitHub repository |
| `max_logo_size_mb` | Maximum center image size | `5` |

## Languages

Each language is one file in `lang/`, named after its [BCP 47](https://www.rfc-editor.org/info/bcp47) locale code: `language[-Script][-REGION]`, e.g. `pl.php`, `en-GB.php`, `sr-Latn.php`, `zh-HK.php`. Codes are matched case-insensitively, so `?lang=en-gb` works too.

The language is chosen in this order:

1. `?lang=<code>` in the URL (the choice is saved in a cookie),
2. the saved cookie,
3. the browser's `Accept-Language` header - each tag is tried from most to least specific (`sr-Latn-RS` → `sr-Latn` → `sr`), and *aliases* map codes without their own file (e.g. `no` → `nb`, `zh-Hant` → `zh-TW`, `es-419` → `es-MX`),
4. `default_language` from `config.php`.

### Regional variants

A regional variant can inherit from another locale with `'parent'` and list only the strings that differ. Lookup order is: the locale itself → its parent chain → `default_language`.

| Variant | Parent | Differences |
|---------|--------|-------------|
| `en-US` | `en` | none |
| `en-GB`, `en-CA`, `en-AU` | `en` / `en-GB` | British spelling (colour, centre) |
| `de-AT` | `de` | none |
| `de-CH` | `de` | "ss" instead of "ß", Swiss quotation marks |
| `fr-CA` | `fr` | "courriel" |
| `es-MX` | `es` | Latin American wording |
| `es-AR` | `es-MX` | voseo ("Ingresá", "Elegí") |
| `nl-BE` | `nl` | none |
| `zh-HK` | `zh-TW` | Hong Kong terms (網絡, 短訊) |

`sr-Cyrl` and `sr-Latn` are complete translations (one is a transliteration of the other).

### Included languages

| Code | Language | Native name | Flag | Notes |
|------|----------|-------------|------|-------|
| `af` | Afrikaans | Afrikaans | za |  |
| `sq` | Albanian | Shqip | al |  |
| `am` | Amharic | አማርኛ | et |  |
| `ar` | Arabic | العربية | arab | RTL |
| `hy` | Armenian | Հայերեն | am |  |
| `az` | Azerbaijani | Azərbaycan dili | az |  |
| `eu` | Basque | Euskara | es-pv |  |
| `be` | Belarusian | Беларуская | by |  |
| `bn` | Bengali | বাংলা | bd |  |
| `bs` | Bosnian | Bosanski | ba |  |
| `bg` | Bulgarian | Български | bg |  |
| `my` | Burmese | မြန်မာ | mm |  |
| `ca` | Catalan | Català | es-ct |  |
| `zh-CN` | Chinese (Simplified) | 简体中文 | cn | aliases: `zh`, `zh-hans`, `zh-hans-cn`, `zh-sg`, `zh-hans-sg` |
| `zh-HK` | Chinese (Traditional, Hong Kong) | 繁體中文（香港） | hk | inherits `zh-TW`; aliases: `zh-hant-hk`, `zh-mo`, `zh-hant-mo` |
| `zh-TW` | Chinese (Traditional, Taiwan) | 繁體中文（台灣） | tw | aliases: `zh-hant`, `zh-hant-tw` |
| `hr` | Croatian | Hrvatski | hr |  |
| `cs` | Czech | Čeština | cz |  |
| `da` | Danish | Dansk | dk |  |
| `nl` | Dutch | Nederlands | nl |  |
| `nl-BE` | Dutch (Belgium) | Nederlands (België) | be | inherits `nl` |
| `en` | English | English | gb | default |
| `en-AU` | English (Australia) | English (Australia) | au | inherits `en-GB`; aliases: `en-nz` |
| `en-CA` | English (Canada) | English (Canada) | ca | inherits `en-GB` |
| `en-GB` | English (UK) | English (UK) | gb | inherits `en`; aliases: `en-ie` |
| `en-US` | English (US) | English (US) | us | inherits `en` |
| `et` | Estonian | Eesti | ee |  |
| `fil` | Filipino | Filipino | ph | aliases: `tl`, `tl-ph`, `fil-ph` |
| `fi` | Finnish | Suomi | fi |  |
| `fr` | French | Français | fr |  |
| `fr-CA` | French (Canada) | Français (Canada) | ca | inherits `fr` |
| `gl` | Galician | Galego | es-ga |  |
| `ka` | Georgian | ქართული | ge |  |
| `de` | German | Deutsch | de |  |
| `de-AT` | German (Austria) | Deutsch (Österreich) | at | inherits `de` |
| `de-CH` | German (Switzerland) | Deutsch (Schweiz) | ch | inherits `de`; aliases: `de-li` |
| `el` | Greek | Ελληνικά | gr |  |
| `gu` | Gujarati | ગુજરાતી | in |  |
| `ha` | Hausa | Hausa | ng |  |
| `he` | Hebrew | עברית | il | RTL; aliases: `iw`, `iw-il` |
| `hi` | Hindi | हिन्दी | in |  |
| `hu` | Hungarian | Magyar | hu |  |
| `is` | Icelandic | Íslenska | is |  |
| `ig` | Igbo | Igbo | ng |  |
| `id` | Indonesian | Bahasa Indonesia | id | aliases: `in` |
| `ga` | Irish | Gaeilge | ie |  |
| `it` | Italian | Italiano | it |  |
| `ja` | Japanese | 日本語 | jp |  |
| `kn` | Kannada | ಕನ್ನಡ | in |  |
| `kk` | Kazakh | Қазақ тілі | kz |  |
| `km` | Khmer | ខ្មែរ | kh |  |
| `ko` | Korean | 한국어 | kr |  |
| `lo` | Lao | ລາວ | la |  |
| `lv` | Latvian | Latviešu | lv |  |
| `lt` | Lithuanian | Lietuvių | lt |  |
| `lb` | Luxembourgish | Lëtzebuergesch | lu |  |
| `mk` | Macedonian | Македонски | mk |  |
| `ms` | Malay | Bahasa Melayu | my |  |
| `ml` | Malayalam | മലയാളം | in |  |
| `mr` | Marathi | मराठी | in |  |
| `mn` | Mongolian | Монгол | mn |  |
| `ne` | Nepali | नेपाली | np |  |
| `nb` | Norwegian (Bokmål) | Norsk bokmål | no | aliases: `no`, `nn`, `nb-no`, `nn-no` |
| `fa` | Persian | فارسی | ir | RTL |
| `pl` | Polish | Polski | pl |  |
| `pt-BR` | Portuguese (Brazil) | Português (Brasil) | br |  |
| `pt-PT` | Portuguese (Portugal) | Português (Portugal) | pt | aliases: `pt` |
| `pa` | Punjabi | ਪੰਜਾਬੀ | in | aliases: `pa-in`, `pa-guru` |
| `ro` | Romanian | Română | ro | aliases: `mo`, `ro-md` |
| `ru` | Russian | Русский | ru |  |
| `sr-Cyrl` | Serbian (Cyrillic) | Српски (ћирилица) | rs | aliases: `sr`, `sr-rs`, `sr-cyrl-rs`, `sr-me`, `sr-cyrl-me`, `sr-ba`, `sr-cyrl-ba` |
| `sr-Latn` | Serbian (Latin) | Srpski (latinica) | rs | aliases: `sr-latn-rs`, `sr-latn-me`, `sr-latn-ba`, `sh` |
| `si` | Sinhala | සිංහල | lk |  |
| `sk` | Slovak | Slovenčina | sk |  |
| `sl` | Slovenian | Slovenščina | si |  |
| `so` | Somali | Soomaali | so |  |
| `es` | Spanish | Español | es |  |
| `es-AR` | Spanish (Argentina) | Español (Argentina) | ar | inherits `es-MX`; aliases: `es-uy`, `es-py` |
| `es-MX` | Spanish (Mexico) | Español (México) | mx | inherits `es`; aliases: `es-419`, `es-us`, `es-co`, `es-cl`, `es-pe`, `es-ve`, `es-ec`, `es-gt`, `es-cu`, `es-bo`, `es-do`, `es-hn`, `es-sv`, `es-ni`, `es-cr`, `es-pa`, `es-pr` |
| `sw` | Swahili | Kiswahili | tz |  |
| `sv` | Swedish | Svenska | se |  |
| `ta` | Tamil | தமிழ் | in |  |
| `te` | Telugu | తెలుగు | in |  |
| `th` | Thai | ไทย | th |  |
| `tr` | Turkish | Türkçe | tr |  |
| `uk` | Ukrainian | Українська | ua |  |
| `ur` | Urdu | اردو | pk | RTL |
| `vi` | Vietnamese | Tiếng Việt | vn |  |
| `cy` | Welsh | Cymraeg | gb-wls |  |
| `xh` | Xhosa | isiXhosa | za |  |
| `yo` | Yoruba | Yorùbá | ng |  |
| `zu` | Zulu | isiZulu | za |  |

### Adding a new language

1. Copy `lang/en.php` to `lang/<code>.php`, e.g. `lang/fr-BE.php` or `lang/uz.php`.
2. Update the `_meta` block:

   ```php
   '_meta' => [
       'name'    => 'Uzbek',     // English name (shown under the native name)
       'native'  => 'Oʻzbekcha', // name shown in the dropdown
       'dir'     => 'ltr',       // 'rtl' for right-to-left languages
       'flag'    => 'uz',        // flag file name (usually the ISO 3166-1 country code)
       'aliases' => ['uz-latn'], // optional: extra browser codes for this language
       // 'parent' => 'fr',      // optional: inherit missing strings from another locale
   ],
   ```

3. Translate the values (keep the keys unchanged). For a regional variant with a `parent`, keep only the strings that differ.
4. If the flag is not bundled yet, download it into `assets/vendor/flag-icons/flags/`:

   ```bash
   curl -L -o assets/vendor/flag-icons/flags/uz.svg https://cdn.jsdelivr.net/npm/flag-icons@7.6.0/flags/4x3/uz.svg
   ```

That's all - the new language appears in the dropdown automatically. Missing keys fall back to the parent and then the default language, so partial translations are safe. Keys starting with `js.` are passed to the browser script; placeholders like `{size}` are replaced at runtime.

> **Translation quality:** the translations were machine-assisted. Major languages should be in good shape, but for less widely used languages (for example Hausa, Igbo, Yoruba, Xhosa, Zulu, Somali, Lao, Khmer, Burmese) a review by a native speaker is recommended before production use.

### Checking translations

After adding or editing a language, run:

```bash
php tools/check-translations.php
```

It reports missing or unknown keys, lost placeholders (`{size}`, `{author}`), broken parents, missing flags and duplicate aliases, and exits with code 1 on errors (handy in CI).

## Privacy and consent

- Nothing the visitor types or uploads is ever sent to the server - QR codes are generated in the browser.
- On the first visit a dialog asks for consent to store preferences. Until the visitor accepts, **no cookies are written** and the page cannot be used. Declining shows a short explanation with options to go back or close the page.
- After consent the app stores `qr_consent`, `qr_lang` and `qr_theme` (preferences only) - as cookies in the PHP version, in `localStorage` in the static version, and the current form settings in `sessionStorage` (cleared when the tab is closed). No analytics or third-party requests.

## Project structure

```
QRCode-WebApp/
├── index.php                 # Entry point: language detection, headers, rendering
├── config.php                # Application settings
├── manifest.webmanifest      # Web app manifest (installable app)
├── LICENSE                   # MIT license
├── src/
│   ├── I18n.php              # Translation service (auto-discovers languages)
│   └── View.php              # Renders the page (PHP server and static build)
├── lang/
│   ├── en.php                # English - default / fallback
│   ├── en-GB.php             # Regional variant (only differences, inherits from en)
│   ├── pl.php                # Polish
│   └── …                     # 92 locales in total
├── templates/
│   └── app.php               # Page markup
├── assets/
│   ├── css/style.css         # Styles (light & dark mode, responsive)
│   ├── js/ui.js              # Consent dialog, theme toggle, language dropdown
│   ├── js/theme-init.js      # Static build: applies the saved theme early
│   ├── js/redirect.js        # Static build: start page and 404 redirects
│   ├── js/app.js             # QR payload builders, preview, downloads, print, share
│   ├── js/export.js          # PDF, EPS, BMP, GIF and AVIF exporters
│   ├── img/                  # Favicon and app icons (SVG + PNG)
│   └── vendor/
│       ├── qr-code-styling/  # QR rendering library (bundled, MIT)
│       ├── flag-icons/       # Flag SVGs (bundled, MIT)
│       ├── gifenc/           # GIF encoder (bundled, MIT, loaded on demand)
│       └── jsquash-avif/     # AVIF encoder, WebAssembly (bundled, Apache-2.0, loaded on demand)
├── tools/
│   ├── check-translations.php  # Validates all language files (CLI only)
│   └── build-static.php        # Builds the static GitHub Pages version (CLI only)
├── .github/workflows/pages.yml # Deploys the static version to GitHub Pages
└── .htaccess                 # Apache rules
```

## How it works

PHP renders the page and handles translations. QR codes are generated in the browser by [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) (v1.9.2, MIT license), which is bundled locally in `assets/vendor/` together with the flag images from [flag-icons](https://github.com/lipis/flag-icons) (v7.6.0, MIT license), the GIF encoder [gifenc](https://github.com/mattdesl/gifenc) (v1.0.3, MIT) and the AVIF encoder from [jSquash](https://github.com/jamsinclair/jSquash) (v2.1.1, Apache-2.0), so the application works offline and does not load anything from third-party CDNs.

The content types are encoded using the common formats understood by phone camera apps:

| Type | Format |
|------|--------|
| Link | `https://…` (the scheme is added automatically if missing) |
| E-mail | `mailto:address?subject=…&body=…` |
| Phone | `tel:+48…` |
| SMS | `SMSTO:number:message` |
| Wi-Fi | `WIFI:T:WPA;S:name;P:password;H:true;;` |
| Contact | vCard 3.0 |
| Location | `geo:lat,lng` |

### Export formats

| Format | How it is made | Notes |
|--------|----------------|-------|
| PNG, JPG, WebP | Browser (canvas) | JPG has no transparency - the background color is used |
| SVG | qr-code-styling | Vector; also available as **Copy SVG code** |
| PDF | Built in `assets/js/export.js` | Lossless image at up to 3x resolution (about 300 DPI); keeps transparency; page size = chosen size at 96 DPI (600 px = 15.9 cm) |
| EPS | Built in `assets/js/export.js` | PostScript level 3, lossless image at up to 3x resolution, for print shops |
| BMP | Built in `assets/js/export.js` | 24-bit, no transparency |
| GIF | gifenc (loaded on demand) | 256 colors, 1-bit transparency |
| AVIF | Browser if supported, otherwise the jSquash WebAssembly encoder (3.5 MB, loaded only when AVIF is chosen) | Small files with transparency |

PDF and EPS contain a high-resolution image of the code (not vector paths). **Print** prints only the code at the chosen size, and **Share** (shown only where the browser can share files, mostly on phones) sends a PNG to other apps. All exports are created in the browser - nothing is uploaded.

The Content Security Policy allows `wasm-unsafe-eval` so the AVIF encoder can run; it does not allow JavaScript `eval()`.

### Tips for readable codes

- When you add a center image, use the **High (30%)** error correction level (it is selected automatically when an image is added) and keep the image size at 30-40%. The slider stops at 40%: in automated scan tests (6 dot styles × several corner styles, decoded with jsQR and ZXing) every code with a 45% logo was still readable, while **every code with a 50% logo failed**.
- Keep enough contrast between dots and background; dark dots on a light background scan best.
- Leave a margin (quiet zone) around the code when printing it.
- Always test the final code with a phone before printing.

## Updating the QR library

```bash
curl -L -o assets/vendor/qr-code-styling/qr-code-styling.js https://cdn.jsdelivr.net/npm/qr-code-styling@<version>/lib/qr-code-styling.js
```

## License

Released under the [MIT License](LICENSE) - Copyright (c) 2026 [Pascold](https://github.com/Pascold).

You may use, copy, modify and distribute this software, **commercially or not**, as long as the copyright notice with the author's name and the license text are kept in all copies or substantial portions of the software.

The bundled third-party libraries keep their own licenses:
[qr-code-styling](assets/vendor/qr-code-styling/LICENSE) (MIT),
[flag-icons](assets/vendor/flag-icons/LICENSE) (MIT),
[gifenc](assets/vendor/gifenc/LICENSE.md) (MIT) and
[jSquash AVIF](assets/vendor/jsquash-avif/LICENSE) (Apache-2.0).
