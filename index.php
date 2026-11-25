<?php

declare(strict_types=1);

use QrApp\I18n;
use QrApp\View;

require __DIR__ . '/src/I18n.php';
require __DIR__ . '/src/View.php';

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

// Remember an explicitly chosen language. This is a functional preference
// cookie (no tracking), so it needs no consent banner.
if ($requested !== null && $i18n->normalize($requested) !== null && $language !== $saved) {
    setcookie($config['language_cookie'], $language, [
        'expires' => time() + (int) $config['language_cookie_lifetime'],
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        // Also written by assets/js/ui.js.
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
// frame-ancestors only works as a header (not in the <meta> tag of the static build).
header('Content-Security-Policy: ' . View::CONTENT_SECURITY_POLICY . "; frame-ancestors 'self'");

echo View::render($i18n, $config, [
    'theme' => $theme,
]);
