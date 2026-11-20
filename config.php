<?php

declare(strict_types=1);

/**
 * Application configuration.
 *
 * Adjust these values to fit your environment. No other file needs to be
 * changed to deploy the application.
 */
return [
    // Language used when the visitor has no saved preference and the
    // browser's Accept-Language header does not match any available language.
    'default_language' => 'en',

    // Directory with translation files. Every "<code>.php" file in this
    // directory is picked up automatically as an available language.
    'language_dir' => __DIR__ . '/lang',

    // Cookie used to remember the selected language.
    'language_cookie' => 'qr_lang',
    'language_cookie_lifetime' => 60 * 60 * 24 * 365, // 1 year

    // Cookie that remembers the light/dark theme chosen with the header
    // button. Without it the operating system setting is used.
    'theme_cookie' => 'qr_theme',

    // Cookie that stores the visitor's consent (shown in a dialog on the
    // first visit). Language and theme cookies are only written after consent.
    'consent_cookie' => 'qr_consent',

    // Credits shown in the footer.
    'author_name' => 'Pascold',
    'author_url' => 'https://github.com/Pascold',
    'repository_url' => 'https://github.com/Pascold/QRCode-WebApp',
    'license_url' => 'https://github.com/Pascold/QRCode-WebApp/blob/main/LICENSE',

    // Maximum size of the uploaded center image (validated in the browser,
    // the image never leaves the visitor's device).
    'max_logo_size_mb' => 5,
];
