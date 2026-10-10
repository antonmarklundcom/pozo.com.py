<?php
declare(strict_types=1);
require_once __DIR__ . '/vendercrm-config.php';

/** Configuration only; caller keeps WhatsApp/Resend running when valid=false. */
function pozo_crm_settings(string $publicRoot, array $privateConfig, string $defaultUrl, string $legacyPath, ?array $environment = null, bool $localTest = false): array
{
    $env = $environment ?? [
        'VENDERCRM_URL'=>getenv('VENDERCRM_URL'),
        'VENDERCRM_API_KEY'=>getenv('VENDERCRM_API_KEY'),
        'VENDERCRM_CONFIG_FILE'=>getenv('VENDERCRM_CONFIG_FILE'),
    ];
    try {
        $urlEnv = $env['VENDERCRM_URL'] ?? false;
        $selector = $env['VENDERCRM_CONFIG_FILE'] ?? false;
        $mock = $localTest && is_string($urlEnv) && parse_url($urlEnv, PHP_URL_SCHEME) === 'http' && parse_url($urlEnv, PHP_URL_HOST) === '127.0.0.1' && !$selector;
        // Strict new setup takes priority without opening obsolete legacy paths.
        if ($selector || ($urlEnv && !$mock)) {
            $canonical = \VenderCRM\Config::optional($publicRoot, $env);
            if ($canonical !== null) {
                return ['url'=>$canonical->doctor()['url'], 'key'=>$canonical->apiKey(), 'valid'=>true];
            }
        }
        $legacy = [];
        if (is_readable($legacyPath)) {
            $root = realpath($publicRoot);
            $file = realpath($legacyPath);
            $compareRoot = strtolower(str_replace('\\', '/', (string)$root));
            $compareFile = strtolower(str_replace('\\', '/', (string)$file));
            if ($root === false || $file === false || $compareFile === $compareRoot || strpos($compareFile, rtrim($compareRoot, '/') . '/') === 0) {
                throw new RuntimeException('Unsafe private CRM configuration.');
            }
            ob_start();
            try { $legacy = (static function ($path) { return require $path; })($file); }
            finally { ob_end_clean(); }
            if (!is_array($legacy)) { throw new RuntimeException('Invalid private CRM configuration.'); }
            if (empty($privateConfig['vendercrm_url']) && empty($privateConfig['vendercrm_key'])) {
                $privateConfig['vendercrm_url'] = $privateConfig['vendercrm_url'] ?? ($legacy['url'] ?? null);
                $privateConfig['vendercrm_key'] = $privateConfig['vendercrm_key'] ?? ($legacy['api_key'] ?? null);
            }
        }
        // Compatibility exception: old installs accept key-only environment
        // plus the trusted generated base. A new URL/selector starts strict setup.
        $canonicalEnv = $env;
        if (!$urlEnv || $mock) { unset($canonicalEnv['VENDERCRM_URL'], $canonicalEnv['VENDERCRM_API_KEY']); }
        $defaultPath = dirname((string)realpath($publicRoot)) . '/private/vendercrm.php';
        $sameDefault = realpath($legacyPath) !== false && realpath($legacyPath) === realpath($defaultPath);
        $oldShape = $sameDefault && count($legacy) === 2 && array_key_exists('url', $legacy) && array_key_exists('api_key', $legacy);
        $canonical = !$selector && (!$urlEnv || $mock) && $oldShape ? null : \VenderCRM\Config::optional($publicRoot, $canonicalEnv);
        if ($canonical !== null) {
            return ['url'=>$canonical->doctor()['url'], 'key'=>$canonical->apiKey(), 'valid'=>true];
        }
        $url = rtrim((string)($urlEnv ?: ($privateConfig['vendercrm_url'] ?? $defaultUrl)), '/');
        $key = (string)(($env['VENDERCRM_API_KEY'] ?? false) ?: ($privateConfig['vendercrm_key'] ?? ''));
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $local = $localTest && parse_url($url, PHP_URL_HOST) === '127.0.0.1' && $scheme === 'http';
        return ['url'=>$url, 'key'=>$key, 'valid'=>(bool)(filter_var($url, FILTER_VALIDATE_URL) && ($scheme === 'https' || $local))];
    } catch (Throwable $error) {
        // Never fall back to stale CRM credentials after a canonical error.
        return ['url'=>'', 'key'=>'', 'valid'=>false];
    }
}
