# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-25

First public release.

### Content types

- Links, App Store / Google Play apps, plain text, e-mail, phone, SMS, WhatsApp, Wi-Fi, contact cards (vCard 3.0 or MeCard), calendar events (iCalendar) and map locations. Any language and emoji are encoded as UTF-8.

### Styling

- Six dot styles, corner frame and corner center styles, colors, gradient, transparent background, size, margin and error correction level.
- Your own image or logo in the center: choose a file, drag it onto the card or paste it with Ctrl+V.
- Saved styles (in the browser) and a **style link** that shares the look, without the content.
- Undo / redo (Ctrl+Z / Ctrl+Y).

### Export

- PNG, SVG, PDF, JPG, WebP, AVIF, GIF, BMP and EPS, plus Print, Share, Copy image and Copy SVG code.
- Print size in mm, cm or inches at 150, 300 or 600 DPI for PDF, EPS and printing.

### Quality checks

- Readability check: every change is decoded in the browser with jsQR, as a phone camera would.
- Warning for low contrast and inverted (light-on-dark) codes.

### App

- 92 languages and regional variants, including right-to-left scripts, in a searchable dropdown with flags.
- Light and dark theme, following the operating system by default.
- Works offline after the first visit and can be installed as an app.
- Link previews (Open Graph / Twitter Card) for social media and chat apps.
- Everything runs in the browser: no uploads, no tracking, no analytics, no third-party requests, and no cookie banner.
- Runs on any PHP 8.2+ server, or as a static site on GitHub Pages (built and deployed by GitHub Actions).

[1.0.0]: https://github.com/Pascold/QRCode-WebApp/releases/tag/v1.0.0
