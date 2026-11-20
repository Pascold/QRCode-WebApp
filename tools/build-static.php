<?php

declare(strict_types=1);

/**
 * Builds a static version of the site, e.g. for GitHub Pages.
 *
 * Usage (from the project root):
 *
 *     php tools/build-static.php [--out=dist] [--base=/]
 *
 *   --out   output directory (default: dist). It is deleted and recreated,
 *           but only if it is empty or was created by this script.
 *   --base  URL path the site is served from, used by the 404 page.
 *           GitHub Pages project site: --base=/<repository-name>/
 *           Custom domain / user site: --base=/ (default)
 *
 * Output:
 *   index.html          start page - opens the saved or browser language
 *   <code>/index.html   one page per language, e.g. pl/, en-GB/, sr-Latn/
 *   404.html            fixes the letter case of language URLs (/en-gb/ -> /en-GB/)
 *   assets/, manifest.webmanifest, sw.js (offline support), LICENSE, .nojekyll
 */

use QrApp\I18n;
use QrApp\View;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
require $root . '/src/I18n.php';
require $root . '/src/View.php';

$options = getopt('', ['out::', 'base::']);
$outArg = (string) ($options['out'] ?? 'dist');
$out = preg_match('~^([A-Za-z]:)?[\\\\/]~', $outArg) === 1 ? $outArg : $root . '/' . $outArg;
$base = '/' . trim((string) ($options['base'] ?? '/'), '/') . '/';
$base = $base === '//' ? '/' : $base;

const MARKER = '.qr-static-build';

/** @var array<string, mixed> $config */
$config = require $root . '/config.php';
$i18n = new I18n($config['language_dir'], $config['default_language']);
$e = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

// ---------------------------------------------------------------------------
// Prepare the output directory
// ---------------------------------------------------------------------------
$removeTree = static function (string $dir) use (&$removeTree): void {
    foreach (scandir($dir) ?: [] as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . '/' . $item;
        is_dir($path) && !is_link($path) ? $removeTree($path) : unlink($path);
    }
    rmdir($dir);
};

$realRoot = realpath($root);
if (is_dir($out)) {
    $isEmpty = count(scandir($out) ?: []) <= 2;
    if (realpath($out) === $realRoot || (!$isEmpty && !is_file($out . '/' . MARKER))) {
        fwrite(STDERR, "Refusing to overwrite $out: it is not empty and was not created by this script.\n");
        exit(1);
    }
    $removeTree($out);
}
mkdir($out, 0777, true);
file_put_contents($out . '/' . MARKER, "Created by tools/build-static.php - safe to delete.\n");

$copyTree = static function (string $from, string $to) use (&$copyTree): void {
    if (!is_dir($to)) {
        mkdir($to, 0777, true);
    }
    foreach (scandir($from) ?: [] as $item) {
        if ($item === '.' || $item === '..' || $item === '.htaccess') {
            continue;
        }
        $source = $from . '/' . $item;
        is_dir($source) ? $copyTree($source, $to . '/' . $item) : copy($source, $to . '/' . $item);
    }
};

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
$copyTree($root . '/assets', $out . '/assets');
copy($root . '/manifest.webmanifest', $out . '/manifest.webmanifest');
copy($root . '/sw.js', $out . '/sw.js');
copy($root . '/LICENSE', $out . '/LICENSE');
// Tells GitHub Pages not to run Jekyll on the output.
file_put_contents($out . '/.nojekyll', '');

// ---------------------------------------------------------------------------
// One page per language
// ---------------------------------------------------------------------------
$languages = $i18n->languages();
foreach (array_keys($languages) as $code) {
    $i18n->setLanguage($code);
    $html = View::render($i18n, $config, [
        'static' => true,
        'base_path' => '../',
        'lang_url' => static fn (string $target): string => '../' . $target . '/',
    ]);
    mkdir($out . '/' . $code, 0777, true);
    file_put_contents($out . '/' . $code . '/index.html', $html);
}

// ---------------------------------------------------------------------------
// Start page and 404 page
// ---------------------------------------------------------------------------
$i18n->setLanguage($i18n->defaultLanguage());

/**
 * @param string $mode   "start" or "404"
 * @param string $prefix URL prefix for assets and language links
 */
$landing = static function (string $mode, string $prefix) use ($i18n, $config, $e, $base, $languages): string {
    $redirect = [
        'mode' => $mode,
        'base' => $base,
        'defaultLanguage' => $i18n->defaultLanguage(),
        'consentKey' => (string) $config['consent_cookie'],
        'languageKey' => (string) $config['language_cookie'],
        'lookup' => $i18n->lookupTable(),
    ];
    $json = json_encode($redirect, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_THROW_ON_ERROR);

    $links = '';
    foreach ($languages as $code => $language) {
        $links .= '<li><a href="' . $e($prefix . $code . '/') . '" hreflang="' . $e($code) . '" lang="' . $e($code) . '">'
            . $e($language['native']) . '</a></li>';
    }

    return '<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="' . $e(View::CONTENT_SECURITY_POLICY) . '">
    <meta name="referrer" content="same-origin">
    <meta name="color-scheme" content="light dark">
    <title>' . $e($i18n->t('app.title')) . '</title>
    <meta name="description" content="' . $e($i18n->t('app.tagline')) . '">
    <link rel="icon" href="' . $e($prefix . 'assets/img/favicon.svg') . '" type="image/svg+xml">
    <link rel="manifest" href="' . $e($prefix . 'manifest.webmanifest') . '">
    <link rel="stylesheet" href="' . $e($prefix . 'assets/css/style.css') . '">
    <script id="redirect-config" type="application/json">' . $json . '</script>
    <script src="' . $e($prefix . 'assets/js/redirect.js') . '"></script>
</head>
<body>
<main class="container landing">
    <h1>' . $e($i18n->t('app.title')) . '</h1>
    <p>' . $e($i18n->t('app.tagline')) . '</p>
    <ul class="landing-languages">' . $links . '</ul>
</main>
</body>
</html>
';
};

file_put_contents($out . '/index.html', $landing('start', ''));
file_put_contents($out . '/404.html', $landing('404', $base));

printf("Built %d language pages into %s (base: %s)\n", count($languages), $out, $base);
