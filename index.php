<?php

declare(strict_types=1);

use QrApp\I18n;

require __DIR__ . '/src/I18n.php';

/** @var array<string, mixed> $config */
$config = require __DIR__ . '/config.php';

// ---------------------------------------------------------------------------
// Language selection: ?lang=xx > cookie > browser preference > default
// ---------------------------------------------------------------------------
$i18n = new I18n($config['language_dir'], $config['default_language']);

$requested = isset($_GET['lang']) && is_string($_GET['lang']) ? strtolower($_GET['lang']) : null;
$saved = isset($_COOKIE[$config['language_cookie']]) && is_string($_COOKIE[$config['language_cookie']])
    ? $_COOKIE[$config['language_cookie']]
    : null;

$language = $i18n->resolve($requested, $saved, $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null);
$i18n->setLanguage($language);

// The visitor accepts storing preferences in a dialog on the first visit
// (assets/js/ui.js). Until then no cookies are written.
$consented = ($_COOKIE[$config['consent_cookie']] ?? null) === '1';

if ($consented && $requested !== null && $i18n->normalize($requested) !== null && $language !== $saved) {
    setcookie($config['language_cookie'], $language, [
        'expires' => time() + (int) $config['language_cookie_lifetime'],
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        // Also written by JavaScript right after consent is given.
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
}

// ---------------------------------------------------------------------------
// Theme: "light", "dark" or null (follow the operating system). The cookie is
// written by assets/js/ui.js; reading it here avoids a flash on page load.
// ---------------------------------------------------------------------------
$themeCookie = $_COOKIE[$config['theme_cookie']] ?? null;
$theme = in_array($themeCookie, ['light', 'dark'], true) ? $themeCookie : null;

// ---------------------------------------------------------------------------
// Security headers (also work when mod_headers is not available)
// ---------------------------------------------------------------------------
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: SAMEORIGIN');
header(
    "Content-Security-Policy: default-src 'self'; script-src 'self'; "
    . "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
    // qr-code-styling fetch()es the center image data URL to embed it.
    . "connect-src 'self' data: blob:; "
    . "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
);

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------
$e = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$t = static fn (string $key, array $params = []): string => $e($i18n->t($key, $params));

/** Cache busting for static assets. */
$asset = static function (string $path) use ($e): string {
    $file = __DIR__ . '/' . $path;
    $version = is_file($file) ? (string) filemtime($file) : '1';

    return $e($path . '?v=' . $version);
};

$jsConfig = [
    'maxLogoSizeMb' => (int) $config['max_logo_size_mb'],
    'themeCookie' => (string) $config['theme_cookie'],
    'consentCookie' => (string) $config['consent_cookie'],
    'languageCookie' => (string) $config['language_cookie'],
    'cookieLifetime' => (int) $config['language_cookie_lifetime'],
    'language' => $i18n->current(),
    'i18n' => $i18n->group('js.'),
];

require __DIR__ . '/templates/app.php';
