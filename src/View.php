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
     * data URL to embed it, hence data:/blob: in connect-src.
     */
    public const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; "
        . "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
        . "connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'";

    /**
     * @param array<string, mixed> $config
     * @param array{
     *     static?: bool,
     *     base_path?: string,
     *     lang_url?: callable(string): string,
     *     theme?: ?string,
     *     consented?: bool,
     * } $options
     *
     * Options:
     *  - static:    true for the static build (preferences in localStorage, CSP as <meta>)
     *  - base_path: prefix for asset URLs, e.g. "" (PHP) or "../" (static language pages)
     *  - lang_url:  builds the URL of a language, e.g. "?lang=pl" (PHP) or "../pl/" (static)
     *  - theme:     "light", "dark" or null (follow the operating system)
     *  - consented: whether the visitor already accepted the consent dialog
     */
    public static function render(I18n $i18n, array $config, array $options = []): string
    {
        $root = dirname(__DIR__);
        $static = (bool) ($options['static'] ?? false);
        $basePath = (string) ($options['base_path'] ?? '');
        $langUrl = $options['lang_url'] ?? static fn (string $code): string => '?lang=' . rawurlencode($code);
        $theme = $options['theme'] ?? null;
        $consented = (bool) ($options['consented'] ?? false);

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
            'consentCookie' => (string) $config['consent_cookie'],
            'languageCookie' => (string) $config['language_cookie'],
            'cookieLifetime' => (int) $config['language_cookie_lifetime'],
            'language' => $i18n->current(),
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
