# Contributing

Thanks for helping! Bug reports, ideas, translations and pull requests are all welcome.

## Running it locally

No database, Composer or build step is needed - only PHP 8.2+.

```bash
git clone https://github.com/Pascold/QRCode-WebApp.git
cd QRCode-WebApp
php -S localhost:8000
```

Open <http://localhost:8000>. Edit a file and reload the page.

To try the static (GitHub Pages) version:

```bash
php tools/build-static.php --out=dist --base=/
php -S localhost:8001 -t dist
```

## Before you open a pull request

```bash
php tools/check-translations.php                     # all language files are valid
find . -name '*.php' -not -path './dist/*' -exec php -l {} \;   # no PHP syntax errors
```

The same checks run in GitHub Actions on every push to `main`.

Please also:

- **test the change in a real browser**, in both light and dark mode, and scan the generated code with a phone if it affects the QR output;
- **keep it dependency-free** - no CDNs, trackers or third-party requests. New libraries go to `assets/vendor/` with their license;
- **keep everything in the browser** - content and images must never be sent to a server;
- add new texts to `lang/en.php` (the default language). Other languages fall back to English, so you do not have to translate them all yourself;
- keep pull requests small and focused on one thing.

## Translations

Each language is one file in [`lang/`](lang/). Native speakers are very welcome to fix wording that sounds machine-made - just edit the file and open a pull request.

To add a language, copy `lang/en.php` to `lang/<code>.php` (a [BCP 47](https://www.rfc-editor.org/info/bcp47) code such as `pt-BR` or `sr-Latn`), translate the values (not the keys) and keep placeholders like `{size}` and `{author}`. A regional variant (e.g. `fr-CA`) can contain only the texts that differ, with `'parent' => 'fr'` in `_meta`. See [Languages](README.md#languages) in the README for details.

## Reporting bugs

Please include the browser and operating system, the content type and style settings you used (the **Copy link to this style** button is handy for that), and what you expected to happen. Never paste real Wi-Fi passwords or personal contact data into an issue.

## License

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
