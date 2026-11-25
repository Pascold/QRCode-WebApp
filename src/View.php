<?php

declare(strict_types=1);

namespace QrApp;

/**
 * Renders the page. Used by index.php (PHP server) and by
 * tools/build-static.php (static build for GitHub Pages).
 */
final class View
{
    /**
     * Content Security Policy shared by the PHP version (HTTP header) and the
     * static build (<meta> tag). qr-code-styling fetch()es the center image
     * data URL to embed it, hence data:/blob: in connect-src. 'wasm-unsafe-eval' lets
     * the AVIF encoder (WebAssembly) run; it does not allow JavaScript eval().
     */
    public const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; "
        . "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
        . "connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'";

    /** Link preview image (1200x630), relative to the site root. */
    public const SOCIAL_IMAGE = 'assets/img/og-image.png';

    /**
     * Open Graph and Twitter Card tags, so shared links show a title,
     * description and image.
     *
     * @param array<string, mixed> $config
     * @param string $path Path of the page below site_url, e.g. "" or "pl/"
     */
    public static function socialMeta(I18n $i18n, array $config, string $path = ''): string
    {
        $e = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $siteUrl = (string) ($config['site_url'] ?? '');
        $title = $i18n->t('app.title');
        $description = $i18n->t('app.tagline');

        $tags = [
            ['property', 'og:type', 'website'],
            ['property', 'og:site_name', $title],
            ['property', 'og:title', $title],
            ['property', 'og:description', $description],
            ['property', 'og:locale', str_replace('-', '_', $i18n->current())],
            ['name', 'twitter:card', $siteUrl !== '' ? 'summary_large_image' : 'summary'],
            ['name', 'twitter:title', $title],
            ['name', 'twitter:description', $description],
        ];
        if ($siteUrl !== '') {
            $image = $siteUrl . self::SOCIAL_IMAGE;
            $tags[] = ['property', 'og:url', $siteUrl . $path];
            $tags[] = ['property', 'og:image', $image];
            $tags[] = ['property', 'og:image:width', '1200'];
            $tags[] = ['property', 'og:image:height', '630'];
            $tags[] = ['property', 'og:image:alt', $title];
            $tags[] = ['name', 'twitter:image', $image];
        }

        $html = '';
        foreach ($tags as [$attribute, $name, $content]) {
            $html .= '    <meta ' . $attribute . '="' . $name . '" content="' . $e($content) . '">' . "\n";
        }

        return $html;
    }

    /**
     * @param array<string, mixed> $config
     * @param array{
     *     static?: bool,
     *     base_path?: string,
     *     lang_url?: callable(string): string,
     *     theme?: ?string,
     * } $options
     *
     * Options:
     *  - static:    true for the static build (preferences in localStorage, CSP as <meta>)
     *  - base_path: prefix for asset URLs, e.g. "" (PHP) or "../" (static language pages)
     *  - lang_url:  builds the URL of a language, e.g. "?lang=pl" (PHP) or "../pl/" (static)
     *  - theme:     "light", "dark" or null (follow the operating system)
     */
    public static function render(I18n $i18n, array $config, array $options = []): string
    {
        $root = dirname(__DIR__);
        $static = (bool) ($options['static'] ?? false);
        $basePath = (string) ($options['base_path'] ?? '');
        $langUrl = $options['lang_url'] ?? static fn (string $code): string => '?lang=' . rawurlencode($code);
        $theme = $options['theme'] ?? null;

        $e = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $t = static fn (string $key, array $params = []): string => $e($i18n->t($key, $params));

        /** URL of a static file (relative to the project root). */
        $url = static fn (string $path): string => $e($basePath . $path);

        /** URL of a static file with a cache-busting version. */
        $asset = static function (string $path) use ($e, $root, $basePath): string {
            $file = $root . '/' . $path;
            $version = is_file($file) ? (string) filemtime($file) : '1';

            return $e($basePath . $path . '?v=' . $version);
        };

        $jsConfig = [
            'maxLogoSizeMb' => (int) $config['max_logo_size_mb'],
            // "cookie" on a PHP server, "local" (localStorage) on static hosting.
            'storage' => $static ? 'local' : 'cookie',
            'themeCookie' => (string) $config['theme_cookie'],
            'languageCookie' => (string) $config['language_cookie'],
            'cookieLifetime' => (int) $config['language_cookie_lifetime'],
            'language' => $i18n->current(),
            // Offline support; registered by app.js.
            'serviceWorker' => $basePath . 'sw.js',
            'i18n' => $i18n->group('js.'),
        ];

        ob_start();
        try {
            require $root . '/templates/app.php';
        } catch (\Throwable $error) {
            ob_end_clean();
            throw $error;
        }

        return (string) ob_get_clean();
    }
}
