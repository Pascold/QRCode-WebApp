<?php

declare(strict_types=1);

namespace QrApp;

/**
 * Minimal file based translation service.
 *
 * Each language lives in its own PHP file named after its BCP 47 locale code
 * (e.g. lang/en.php, lang/en-GB.php, lang/sr-Latn.php). The file returns an
 * array with a "_meta" entry and a flat list of "dot.separated" keys.
 *
 * A regional variant can declare a "parent" locale in "_meta" and contain
 * only the strings that differ. Lookup order: locale > parent chain > default.
 *
 * Adding a language only requires dropping a new file into the directory.
 */
final class I18n
{
    /** Locale code pattern: language[-Script][-REGION], e.g. "pl", "en-US", "sr-Latn", "es-419". */
    private const CODE_PATTERN = '/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/';

    /** @var array<string, array{code: string, name: string, native: string, dir: string, flag: string, parent: ?string}> */
    private array $languages = [];

    /** @var array<string, string> Lowercase code or alias => canonical locale code. */
    private array $lookup = [];

    /** @var array<string, array<string, string>> */
    private array $cache = [];

    /** @var array<string, string> */
    private array $strings = [];

    private string $current;

    public function __construct(
        private readonly string $directory,
        private readonly string $defaultLanguage,
    ) {
        $this->discoverLanguages();

        if (!isset($this->languages[$this->defaultLanguage])) {
            throw new \RuntimeException(sprintf(
                'Default language "%s" has no translation file in %s.',
                $this->defaultLanguage,
                $this->directory,
            ));
        }

        $this->setLanguage($this->defaultLanguage);
    }

    /**
     * Picks the language: explicit request > saved cookie > browser > default.
     */
    public function resolve(?string $requested, ?string $saved, ?string $acceptLanguage): string
    {
        foreach ([$requested, $saved] as $candidate) {
            $code = $candidate !== null ? $this->normalize($candidate) : null;
            if ($code !== null) {
                return $code;
            }
        }

        foreach ($this->parseAcceptLanguage($acceptLanguage ?? '') as $candidate) {
            $code = $this->normalize($candidate);
            if ($code !== null) {
                return $code;
            }
        }

        return $this->defaultLanguage;
    }

    /**
     * Maps a locale code or alias in any letter case (e.g. "en-us", "zh_HK",
     * "no") to an available locale code, or null when there is no match.
     */
    public function normalize(string $code): ?string
    {
        return $this->lookup[strtolower(str_replace('_', '-', trim($code)))] ?? null;
    }

    public function setLanguage(string $code): void
    {
        $code = $this->normalize($code) ?? $this->defaultLanguage;

        $this->current = $code;
        $this->strings = $this->resolveStrings($code);
    }

    public function isAvailable(string $code): bool
    {
        return isset($this->languages[$code]);
    }

    public function current(): string
    {
        return $this->current;
    }

    /** Text direction of the current language ("ltr" or "rtl"). */
    public function direction(): string
    {
        return $this->languages[$this->current]['dir'];
    }

    /**
     * Available languages sorted by their English name, so regional
     * variants are listed right after their base language.
     *
     * @return array<string, array{code: string, name: string, native: string, dir: string, flag: string, parent: ?string}>
     */
    public function languages(): array
    {
        $languages = $this->languages;
        uasort($languages, static fn (array $a, array $b): int => strnatcasecmp($a['name'], $b['name']));

        return $languages;
    }

    /**
     * Returns a translated string. Placeholders such as {count} are replaced
     * with values from $params. Unknown keys return the key itself so missing
     * translations are easy to spot.
     *
     * @param array<string, string|int|float> $params
     */
    public function t(string $key, array $params = []): string
    {
        $text = $this->strings[$key] ?? $key;

        foreach ($params as $name => $value) {
            $text = str_replace('{' . $name . '}', (string) $value, $text);
        }

        return $text;
    }

    /**
     * All strings whose key starts with the given prefix (used to hand
     * translations over to JavaScript).
     *
     * @return array<string, string>
     */
    public function group(string $prefix): array
    {
        $result = [];
        foreach ($this->strings as $key => $value) {
            if (str_starts_with($key, $prefix)) {
                $result[substr($key, strlen($prefix))] = $value;
            }
        }

        return $result;
    }

    private function discoverLanguages(): void
    {
        $files = glob(rtrim($this->directory, '/\\') . '/*.php') ?: [];
        $aliases = [];

        foreach ($files as $file) {
            $code = basename($file, '.php');
            if (preg_match(self::CODE_PATTERN, $code) !== 1) {
                continue;
            }

            $data = $this->includeFile($file);
            $meta = is_array($data['_meta'] ?? null) ? $data['_meta'] : [];
            $parent = isset($meta['parent']) ? (string) $meta['parent'] : null;

            $this->languages[$code] = [
                'code' => $code,
                'name' => (string) ($meta['name'] ?? $code),
                'native' => (string) ($meta['native'] ?? $meta['name'] ?? $code),
                'dir' => ($meta['dir'] ?? 'ltr') === 'rtl' ? 'rtl' : 'ltr',
                // Flag file name in assets/vendor/flag-icons/flags/ (usually an ISO 3166-1 country code).
                'flag' => strtolower((string) ($meta['flag'] ?? '')),
                'parent' => $parent,
            ];
            $this->lookup[strtolower($code)] = $code;

            foreach ((array) ($meta['aliases'] ?? []) as $alias) {
                $aliases[strtolower((string) $alias)] ??= $code;
            }
        }

        // Real language files always win over aliases.
        $this->lookup += $aliases;
    }

    /** @return array<string, string> Strings of a locale merged with its parents and the default language. */
    private function resolveStrings(string $code): array
    {
        $strings = [];
        $seen = [];

        for ($current = $code; $current !== null && !isset($seen[$current]); $current = $this->languages[$current]['parent'] ?? null) {
            if (!isset($this->languages[$current])) {
                break;
            }
            $seen[$current] = true;
            $strings += $this->loadStrings($current);
        }

        if (!isset($seen[$this->defaultLanguage])) {
            $strings += $this->loadStrings($this->defaultLanguage);
        }

        return $strings;
    }

    /** @return array<string, string> */
    private function loadStrings(string $code): array
    {
        if (!isset($this->cache[$code])) {
            $data = $this->includeFile(rtrim($this->directory, '/\\') . '/' . $code . '.php');
            unset($data['_meta']);
            $this->cache[$code] = array_map('strval', $data);
        }

        return $this->cache[$code];
    }

    /** @return array<string, mixed> */
    private function includeFile(string $file): array
    {
        $data = (static fn (string $path): mixed => require $path)($file);

        return is_array($data) ? $data : [];
    }

    /**
     * Language tags from an Accept-Language header ordered by preference.
     * Each tag is followed by its shorter forms ("sr-latn-rs" -> "sr-latn" -> "sr")
     * so regional variants fall back to the closest available language.
     *
     * @return list<string>
     */
    private function parseAcceptLanguage(string $header): array
    {
        $weighted = [];

        foreach (explode(',', $header) as $index => $part) {
            $pieces = explode(';', trim($part));
            $tag = strtolower(str_replace('_', '-', trim($pieces[0])));
            if ($tag === '' || $tag === '*') {
                continue;
            }

            $quality = 1.0;
            foreach (array_slice($pieces, 1) as $param) {
                if (str_starts_with(trim($param), 'q=')) {
                    $quality = (float) substr(trim($param), 2);
                }
            }

            $subtags = explode('-', $tag);
            for ($length = count($subtags), $step = 0; $length > 0; $length--, $step++) {
                // Shorter forms rank just below the full tag but above the next language.
                $weighted[] = [implode('-', array_slice($subtags, 0, $length)), $quality - $step * 0.0001, $index];
            }
        }

        usort($weighted, static fn (array $a, array $b): int => [$b[1], $a[2]] <=> [$a[1], $b[2]]);

        return array_values(array_unique(array_column($weighted, 0)));
    }
}
