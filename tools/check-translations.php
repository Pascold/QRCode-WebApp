<?php

declare(strict_types=1);

/**
 * Checks all translation files in lang/.
 *
 * Usage (from the project root):
 *
 *     php tools/check-translations.php
 *
 * Verifies that:
 *  - every file name is a valid locale code and the file returns an array with "_meta",
 *  - "_meta" has name, native and flag, and the flag image exists,
 *  - a "parent" (if any) exists and does not create a loop,
 *  - every key of the default language resolves (directly or through parents),
 *  - no file contains keys unknown to the default language,
 *  - placeholders such as {size} or {author} are kept,
 *  - aliases are not claimed by more than one language.
 *
 * Exit code 0 = all good, 1 = problems found.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$config = require $root . '/config.php';
$langDir = $config['language_dir'];
$default = $config['default_language'];
$flagDir = $root . '/assets/vendor/flag-icons/flags';

$errors = [];
$warnings = [];
$files = [];

foreach (glob($langDir . '/*.php') ?: [] as $file) {
    $code = basename($file, '.php');
    if (preg_match('/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/', $code) !== 1) {
        $errors[] = "$code: file name is not a valid locale code (e.g. pl, en-GB, sr-Latn) - it is ignored by the app";
        continue;
    }
    $data = require $file;
    if (!is_array($data) || !is_array($data['_meta'] ?? null)) {
        $errors[] = "$code: file must return an array with a '_meta' entry";
        continue;
    }
    $files[$code] = $data;
}

if (!isset($files[$default])) {
    fwrite(STDERR, "Default language '$default' not found in $langDir\n");
    exit(1);
}

$base = $files[$default];
unset($base['_meta']);
$aliases = [];

/** Strings of a locale merged with its parent chain (not including the default). */
$resolve = static function (string $code) use ($files): array {
    $strings = [];
    $seen = [];
    for ($current = $code; $current !== null && isset($files[$current]) && !isset($seen[$current]); $current = $files[$current]['_meta']['parent'] ?? null) {
        $seen[$current] = true;
        $own = $files[$current];
        unset($own['_meta']);
        $strings += $own;
    }

    return $strings;
};

foreach ($files as $code => $data) {
    $meta = $data['_meta'];

    foreach (['name', 'native', 'flag'] as $field) {
        if (empty($meta[$field])) {
            $errors[] = "$code: _meta.$field is missing";
        }
    }
    if (!empty($meta['flag']) && !is_file($flagDir . '/' . $meta['flag'] . '.svg')) {
        $errors[] = "$code: flag image assets/vendor/flag-icons/flags/{$meta['flag']}.svg not found";
    }
    if (isset($meta['dir']) && !in_array($meta['dir'], ['ltr', 'rtl'], true)) {
        $errors[] = "$code: _meta.dir must be 'ltr' or 'rtl'";
    }

    // Parent chain.
    $parent = $meta['parent'] ?? null;
    $seen = [$code => true];
    while ($parent !== null) {
        if (!isset($files[$parent])) {
            $errors[] = "$code: parent '$parent' does not exist";
            break;
        }
        if (isset($seen[$parent])) {
            $errors[] = "$code: parent chain loops back to '$parent'";
            break;
        }
        $seen[$parent] = true;
        $parent = $files[$parent]['_meta']['parent'] ?? null;
    }

    foreach ((array) ($meta['aliases'] ?? []) as $alias) {
        $alias = strtolower((string) $alias);
        if (isset($aliases[$alias])) {
            $warnings[] = "$code: alias '$alias' is also used by {$aliases[$alias]} (the first file wins)";
        } else {
            $aliases[$alias] = $code;
        }
    }

    $own = $data;
    unset($own['_meta']);

    foreach (array_diff_key($own, $base) as $key => $unused) {
        $errors[] = "$code: unknown key '$key'";
    }

    $strings = $resolve($code);
    $missing = $code === $default ? [] : array_keys(array_diff_key($base, $strings));
    if ($missing) {
        $errors[] = "$code: missing " . count($missing) . ' key(s): ' . implode(', ', array_slice($missing, 0, 8)) . (count($missing) > 8 ? ', ...' : '');
    }

    foreach ($own as $key => $value) {
        if (!isset($base[$key]) || !is_string($value)) {
            continue;
        }
        if (trim($value) === '') {
            $errors[] = "$code: '$key' is empty";
        }
        preg_match_all('/\{[a-z_]+\}/', $base[$key], $expected);
        foreach ($expected[0] as $placeholder) {
            if (!str_contains($value, $placeholder)) {
                $errors[] = "$code: '$key' is missing the placeholder $placeholder";
            }
        }
    }
}

foreach ($warnings as $warning) {
    echo "warning: $warning\n";
}
foreach ($errors as $error) {
    echo "error: $error\n";
}

printf("%d language file(s) checked, %d error(s), %d warning(s).\n", count($files), count($errors), count($warnings));
exit($errors ? 1 : 0);
