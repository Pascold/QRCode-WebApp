<?php

declare(strict_types=1);

/**
 * Main page template.
 *
 * @var \QrApp\I18n $i18n
 * @var array<string, mixed> $config
 * @var array<string, mixed> $jsConfig
 * @var string|null $theme
 * @var bool $consented
 * @var \Closure $e
 * @var \Closure $t
 * @var \Closure $asset
 */

$contentTypes = ['url', 'text', 'email', 'phone', 'sms', 'wifi', 'vcard', 'geo'];
$dotShapes = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
$cornerSquareShapes = ['square', 'dot', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
$cornerDotShapes = ['square', 'dot', 'rounded', 'classy'];

/** Renders a <select> with translated shape names. */
$shapeSelect = static function (string $name, array $shapes, string $selected) use ($t): string {
    $html = '<select id="' . $name . '" name="' . $name . '">';
    foreach ($shapes as $shape) {
        $html .= '<option value="' . $shape . '"' . ($shape === $selected ? ' selected' : '') . '>'
            . $t('shape.' . $shape) . '</option>';
    }

    return $html . '</select>';
};

$optional = ' <span class="optional">(' . $t('field.optional') . ')</span>';

/** Renders a flag image (decorative - the language name is always shown next to it). */
$flag = static function (string $country, bool $lazy = false) use ($e): string {
    if ($country === '' || !is_file(dirname(__DIR__) . '/assets/vendor/flag-icons/flags/' . $country . '.svg')) {
        return '<span class="flag" aria-hidden="true"></span>';
    }

    return '<img class="flag" src="assets/vendor/flag-icons/flags/' . $e($country) . '.svg" alt="" width="22" height="16"'
        . ($lazy ? ' loading="lazy"' : '') . '>';
};
?>
<!doctype html>
<html lang="<?= $e($i18n->current()) ?>" dir="<?= $e($i18n->direction()) ?>"<?= $theme !== null ? ' data-theme="' . $e($theme) . '"' : '' ?>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="description" content="<?= $t('app.tagline') ?>">
    <title><?= $t('app.title') ?></title>
    <meta name="theme-color" content="#4f46e5">
    <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="assets/img/icon-32.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="stylesheet" href="<?= $asset('assets/css/style.css') ?>">
</head>
<body>
<header class="site-header">
    <div class="container header-inner">
        <div class="brand">
            <img src="assets/img/favicon.svg" alt="" width="32" height="32">
            <div>
                <h1><?= $t('app.title') ?></h1>
                <p class="tagline"><?= $t('app.tagline') ?></p>
            </div>
        </div>

        <div class="header-tools">
            <button type="button" id="theme-toggle" class="icon-btn theme-toggle"
                    data-label-light="<?= $t('theme.to_light') ?>"
                    data-label-dark="<?= $t('theme.to_dark') ?>"
                    title="<?= $t('theme.toggle') ?>" aria-label="<?= $t('theme.toggle') ?>">
                <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
                <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            </button>

            <?php $currentLanguage = $i18n->languages()[$i18n->current()]; ?>
            <details class="lang-menu" id="lang-menu">
                <summary aria-label="<?= $t('app.language') ?>: <?= $e($currentLanguage['native']) ?>">
                    <?= $flag($currentLanguage['flag']) ?>
                    <span class="lang-current"><?= $e($currentLanguage['native']) ?></span>
                    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </summary>
                <div class="lang-popup">
                    <div class="lang-search">
                        <input type="search" id="lang-search" placeholder="<?= $t('app.search_language') ?>"
                               aria-label="<?= $t('app.search_language') ?>" autocomplete="off" spellcheck="false">
                    </div>
                    <ul class="lang-list" role="list">
                        <?php foreach ($i18n->languages() as $code => $language): ?>
                            <li data-search="<?= $e($language['native'] . ' ' . $language['name'] . ' ' . $code) ?>">
                                <a href="?lang=<?= $e($code) ?>" hreflang="<?= $e($code) ?>"
                                   <?= $code === $i18n->current() ? 'aria-current="true"' : '' ?>>
                                    <?= $flag($language['flag'], true) ?>
                                    <span class="lang-name">
                                        <span lang="<?= $e($code) ?>" dir="<?= $e($language['dir']) ?>"><?= $e($language['native']) ?></span>
                                        <span class="lang-sub"><?= $e($language['name']) ?> · <?= $e($code) ?></span>
                                    </span>
                                </a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                    <p class="lang-empty" id="lang-empty" hidden><?= $t('app.no_language') ?></p>
                </div>
            </details>
        </div>
    </div>
</header>

<noscript><p class="container notice notice-error"><?= $t('app.noscript') ?></p></noscript>

<main class="container layout">
    <form id="qr-form" class="settings" autocomplete="off" novalidate>
        <!-- Content -------------------------------------------------------->
        <section class="card">
            <h2><?= $t('content.heading') ?></h2>

            <div class="type-tabs" role="radiogroup" aria-label="<?= $t('content.type') ?>">
                <?php foreach ($contentTypes as $i => $type): ?>
                    <label class="type-tab">
                        <input type="radio" name="type" value="<?= $type ?>" <?= $i === 0 ? 'checked' : '' ?>>
                        <span><?= $t('type.' . $type) ?></span>
                    </label>
                <?php endforeach; ?>
            </div>

            <fieldset class="type-panel" data-type="url">
                <label for="url"><?= $t('field.url') ?></label>
                <input type="url" id="url" name="url" placeholder="https://example.com" value="https://example.com">
            </fieldset>

            <fieldset class="type-panel" data-type="text" hidden>
                <label for="text"><?= $t('field.text') ?></label>
                <textarea id="text" name="text" rows="4"></textarea>
            </fieldset>

            <fieldset class="type-panel" data-type="email" hidden>
                <label for="email_to"><?= $t('field.email') ?></label>
                <input type="email" id="email_to" name="email_to" placeholder="name@example.com">
                <label for="email_subject"><?= $t('field.subject') . $optional ?></label>
                <input type="text" id="email_subject" name="email_subject">
                <label for="email_body"><?= $t('field.body') . $optional ?></label>
                <textarea id="email_body" name="email_body" rows="3"></textarea>
            </fieldset>

            <fieldset class="type-panel" data-type="phone" hidden>
                <label for="phone"><?= $t('field.phone') ?></label>
                <input type="tel" id="phone" name="phone" placeholder="+48 123 456 789">
            </fieldset>

            <fieldset class="type-panel" data-type="sms" hidden>
                <label for="sms_phone"><?= $t('field.phone') ?></label>
                <input type="tel" id="sms_phone" name="sms_phone" placeholder="+48 123 456 789">
                <label for="sms_message"><?= $t('field.sms_message') . $optional ?></label>
                <textarea id="sms_message" name="sms_message" rows="3"></textarea>
            </fieldset>

            <fieldset class="type-panel" data-type="wifi" hidden>
                <label for="wifi_ssid"><?= $t('field.ssid') ?></label>
                <input type="text" id="wifi_ssid" name="wifi_ssid">
                <label for="wifi_encryption"><?= $t('field.encryption') ?></label>
                <select id="wifi_encryption" name="wifi_encryption">
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass"><?= $t('field.encryption_none') ?></option>
                </select>
                <label for="wifi_password"><?= $t('field.password') ?></label>
                <input type="text" id="wifi_password" name="wifi_password">
                <label class="check"><input type="checkbox" name="wifi_hidden"> <?= $t('field.hidden') ?></label>
            </fieldset>

            <fieldset class="type-panel" data-type="vcard" hidden>
                <div class="row">
                    <div>
                        <label for="vc_first"><?= $t('field.first_name') ?></label>
                        <input type="text" id="vc_first" name="vc_first">
                    </div>
                    <div>
                        <label for="vc_last"><?= $t('field.last_name') ?></label>
                        <input type="text" id="vc_last" name="vc_last">
                    </div>
                </div>
                <div class="row">
                    <div>
                        <label for="vc_org"><?= $t('field.organization') . $optional ?></label>
                        <input type="text" id="vc_org" name="vc_org">
                    </div>
                    <div>
                        <label for="vc_title"><?= $t('field.job_title') . $optional ?></label>
                        <input type="text" id="vc_title" name="vc_title">
                    </div>
                </div>
                <div class="row">
                    <div>
                        <label for="vc_phone"><?= $t('field.phone') . $optional ?></label>
                        <input type="tel" id="vc_phone" name="vc_phone">
                    </div>
                    <div>
                        <label for="vc_email"><?= $t('field.email') . $optional ?></label>
                        <input type="email" id="vc_email" name="vc_email">
                    </div>
                </div>
                <label for="vc_url"><?= $t('field.website') . $optional ?></label>
                <input type="url" id="vc_url" name="vc_url" placeholder="https://">
                <label for="vc_address"><?= $t('field.address') . $optional ?></label>
                <input type="text" id="vc_address" name="vc_address">
            </fieldset>

            <fieldset class="type-panel" data-type="geo" hidden>
                <div class="row">
                    <div>
                        <label for="geo_lat"><?= $t('field.latitude') ?></label>
                        <input type="number" id="geo_lat" name="geo_lat" step="any" min="-90" max="90" placeholder="52.2297">
                    </div>
                    <div>
                        <label for="geo_lng"><?= $t('field.longitude') ?></label>
                        <input type="number" id="geo_lng" name="geo_lng" step="any" min="-180" max="180" placeholder="21.0122">
                    </div>
                </div>
            </fieldset>
        </section>

        <!-- Appearance ----------------------------------------------------->
        <section class="card">
            <h2><?= $t('style.heading') ?></h2>

            <div class="row">
                <div>
                    <label for="dots_type"><?= $t('style.dots') ?></label>
                    <?= $shapeSelect('dots_type', $dotShapes, 'rounded') ?>
                </div>
                <div>
                    <label for="dots_color"><?= $t('style.dots_color') ?></label>
                    <input type="color" id="dots_color" name="dots_color" value="#1f2937">
                </div>
            </div>

            <label class="check"><input type="checkbox" id="gradient" name="gradient"> <?= $t('style.gradient') ?></label>
            <div class="row" data-show-if="gradient" hidden>
                <div>
                    <label for="gradient_color"><?= $t('style.gradient_color') ?></label>
                    <input type="color" id="gradient_color" name="gradient_color" value="#4f46e5">
                </div>
            </div>

            <div class="row">
                <div>
                    <label for="corner_square_type"><?= $t('style.corner_square') ?></label>
                    <?= $shapeSelect('corner_square_type', $cornerSquareShapes, 'extra-rounded') ?>
                </div>
                <div>
                    <label for="corner_square_color"><?= $t('style.corner_square_color') ?></label>
                    <input type="color" id="corner_square_color" name="corner_square_color" value="#1f2937">
                </div>
            </div>

            <div class="row">
                <div>
                    <label for="corner_dot_type"><?= $t('style.corner_dot') ?></label>
                    <?= $shapeSelect('corner_dot_type', $cornerDotShapes, 'dot') ?>
                </div>
                <div>
                    <label for="corner_dot_color"><?= $t('style.corner_dot_color') ?></label>
                    <input type="color" id="corner_dot_color" name="corner_dot_color" value="#4f46e5">
                </div>
            </div>

            <div class="row">
                <div>
                    <label for="background_color"><?= $t('style.background') ?></label>
                    <input type="color" id="background_color" name="background_color" value="#ffffff">
                </div>
                <div class="align-end">
                    <label class="check"><input type="checkbox" name="transparent"> <?= $t('style.transparent') ?></label>
                </div>
            </div>

            <div class="row">
                <div>
                    <label for="size"><?= $t('style.size') ?> <output for="size" data-suffix=" px">600 px</output></label>
                    <input type="range" id="size" name="size" min="200" max="2000" step="50" value="600">
                </div>
                <div>
                    <label for="margin"><?= $t('style.margin') ?> <output for="margin" data-suffix=" px">16 px</output></label>
                    <input type="range" id="margin" name="margin" min="0" max="100" step="2" value="16">
                </div>
            </div>

            <label for="error_correction"><?= $t('style.error_correction') ?></label>
            <select id="error_correction" name="error_correction">
                <option value="L"><?= $t('style.ec_l') ?></option>
                <option value="M"><?= $t('style.ec_m') ?></option>
                <option value="Q" selected><?= $t('style.ec_q') ?></option>
                <option value="H"><?= $t('style.ec_h') ?></option>
            </select>
            <p class="hint"><?= $t('style.error_correction_hint') ?></p>
        </section>

        <!-- Center image --------------------------------------------------->
        <section class="card">
            <h2><?= $t('logo.heading') ?></h2>

            <span class="label"><?= $t('logo.file') ?></span>
            <div class="file-row">
                <!-- The native input is visually hidden so the button text can be translated. -->
                <input type="file" id="logo" name="logo" class="visually-hidden"
                       accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp">
                <label for="logo" class="btn file-btn"><?= $t('logo.choose') ?></label>
                <span id="logo-name" class="file-name" data-empty="<?= $t('logo.none') ?>"><?= $t('logo.none') ?></span>
                <button type="button" id="logo-remove" class="btn btn-ghost" hidden><?= $t('logo.remove') ?></button>
            </div>
            <p class="hint"><?= $t('logo.hint', ['size' => (int) $config['max_logo_size_mb']]) ?></p>

            <div data-show-if="logo" hidden>
                <div class="row">
                    <div>
                        <label for="logo_size"><?= $t('logo.size') ?> <output for="logo_size" data-suffix=" %">30 %</output></label>
                        <!-- Max 40%: in scan tests 50% was never readable, 45% was the limit. -->
                        <input type="range" id="logo_size" name="logo_size" min="10" max="40" step="1" value="30">
                    </div>
                    <div>
                        <label for="logo_margin"><?= $t('logo.margin') ?> <output for="logo_margin" data-suffix=" px">6 px</output></label>
                        <input type="range" id="logo_margin" name="logo_margin" min="0" max="40" step="1" value="6">
                    </div>
                </div>
                <label class="check"><input type="checkbox" name="logo_hide_dots" checked> <?= $t('logo.hide_dots') ?></label>
            </div>
        </section>
    </form>

    <!-- Preview & download ------------------------------------------------->
    <aside class="preview-column">
        <section class="card preview-card">
            <h2><?= $t('preview.heading') ?></h2>
            <div id="qr-preview" class="qr-preview checkerboard" aria-live="polite"></div>
            <p id="qr-empty" class="hint center" hidden><?= $t('preview.empty') ?></p>
            <p id="qr-warning" class="notice notice-warning" role="status" hidden></p>
            <p id="qr-message" class="notice" role="status" hidden></p>

            <h3><?= $t('download.heading') ?></h3>
            <div class="row">
                <div>
                    <label for="filename"><?= $t('download.filename') ?></label>
                    <input type="text" id="filename" name="filename" value="qr-code" form="qr-form">
                </div>
                <div>
                    <label for="format"><?= $t('download.format') ?></label>
                    <select id="format" name="format" form="qr-form">
                        <option value="png">PNG</option>
                        <option value="svg">SVG</option>
                        <option value="jpeg">JPG</option>
                        <option value="webp">WebP</option>
                    </select>
                </div>
            </div>
            <div class="actions">
                <button type="button" id="download" class="btn btn-primary"><?= $t('download.button') ?></button>
                <button type="button" id="copy" class="btn"><?= $t('download.copy') ?></button>
                <button type="button" id="reset" class="btn btn-ghost"><?= $t('download.reset') ?></button>
            </div>
        </section>
    </aside>
</main>

<footer class="container site-footer">
    <p><?= $t('app.footer') ?></p>
    <p class="credits">
        <?php
        // "{author}" is replaced with a link after escaping the translated text.
        $authorLink = '<a href="' . $e((string) $config['author_url']) . '" rel="author noopener" target="_blank">'
            . $e((string) $config['author_name']) . '</a>';
        echo str_replace('{author}', $authorLink, $t('footer.created_by'));
        ?>
        <span aria-hidden="true">·</span>
        <a href="<?= $e((string) $config['repository_url']) ?>" rel="noopener" target="_blank"><?= $t('footer.source') ?></a>
        <span aria-hidden="true">·</span>
        <a href="<?= $e((string) $config['license_url']) ?>" rel="license noopener" target="_blank"><?= $t('footer.license') ?></a>
    </p>
</footer>

<?php if (!$consented): ?>
<!-- Consent dialog: opened by assets/js/ui.js on the first visit. -->
<dialog id="consent" class="consent" aria-labelledby="consent-title" data-open>
    <div class="consent-lang">
        <label for="consent-language" class="visually-hidden"><?= $t('app.language') ?></label>
        <select id="consent-language">
            <?php foreach ($i18n->languages() as $code => $language): ?>
                <option value="<?= $e($code) ?>" <?= $code === $i18n->current() ? 'selected' : '' ?>><?= $e($language['native']) ?></option>
            <?php endforeach; ?>
        </select>
    </div>

    <div class="consent-step" data-step="ask">
        <h2 id="consent-title"><?= $t('consent.title') ?></h2>
        <p><?= $t('consent.text') ?></p>
        <div class="actions">
            <button type="button" class="btn btn-primary" data-consent="accept"><?= $t('consent.accept') ?></button>
            <button type="button" class="btn btn-ghost" data-consent="decline"><?= $t('consent.decline') ?></button>
        </div>
    </div>

    <div class="consent-step" data-step="declined" hidden>
        <h2><?= $t('consent.declined_title') ?></h2>
        <p><?= $t('consent.declined_text') ?></p>
        <div class="actions">
            <button type="button" class="btn btn-primary" data-consent="back"><?= $t('consent.back') ?></button>
            <button type="button" class="btn btn-ghost" data-consent="leave"><?= $t('consent.leave') ?></button>
        </div>
    </div>
</dialog>
<?php endif; ?>

<script id="app-config" type="application/json"><?= json_encode($jsConfig, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?></script>
<script src="<?= $asset('assets/js/ui.js') ?>"></script>
<script src="<?= $asset('assets/vendor/qr-code-styling/qr-code-styling.js') ?>"></script>
<script src="<?= $asset('assets/js/app.js') ?>"></script>
</body>
</html>
