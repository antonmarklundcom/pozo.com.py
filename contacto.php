<?php
declare(strict_types=1);

const VENDERCRM_DEFAULT_URL = 'https://crm.clientes.com.py';
const WHATSAPP_NUMBER_FALLBACK = '595992279599';
const THANK_YOU_PATH = '/gracias/';
const CONTACT_PATH = '/contacto/';
const RESEND_API_BASE_DEFAULT = 'https://api.resend.com';

// form_id -> VenderCRM source. Mirrors CONTACT_SOURCES in site.config.mjs.
// Keep in sync manually: this file has no JS import, PHP reads a plain array.
const CONTACT_SOURCES = [
    'contacto' => 'site:pozo.com.py:contacto',
    'ficha' => 'site:pozo.com.py:ficha-rapida',
];

function redirectTo(string $location): never
{
    header('Location: ' . $location, true, 303);
    exit;
}

function value(string $key, int $maxLength): string
{
    $input = trim((string)($_POST[$key] ?? ''));
    return function_exists('mb_substr') ? mb_substr($input, 0, $maxLength) : substr($input, 0, $maxLength);
}

function stripControlChars(string $text): string
{
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $text) ?? $text;
}

// --- Generated site config (number, site URL, CRM default URL) --------------
$generatedConfigPath = __DIR__ . '/config/site.generated.php';
$generatedConfig = [];
if (is_readable($generatedConfigPath)) {
    $loaded = require $generatedConfigPath;
    if (is_array($loaded)) {
        $generatedConfig = $loaded;
    }
}

$whatsappNumber = (string)($generatedConfig['whatsapp'] ?? WHATSAPP_NUMBER_FALLBACK);
$siteUrl = (string)($generatedConfig['site_url'] ?? 'https://pozo.com.py');
$crmDefaultUrl = (string)($generatedConfig['crm_url'] ?? VENDERCRM_DEFAULT_URL);

function whatsappFallback(array $lead, string $whatsappNumber): never
{
    $lines = [
        'Hola, envié una consulta desde Pozo.com.py.',
        'Nombre: ' . $lead['name'],
        'Teléfono: ' . $lead['phone'],
        'Servicio: ' . $lead['service'],
        'Consulta: ' . $lead['message'],
    ];
    if ($lead['email'] !== '') {
        $lines[] = 'Correo: ' . $lead['email'];
    }
    redirectTo('https://wa.me/' . $whatsappNumber . '?text=' . rawurlencode(implode("\n", $lines)));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo 'Método no permitido.';
    exit;
}

header('Cache-Control: no-store, max-age=0');

// Honeypot: bots receive a normal-looking success without reaching the CRM.
if (value('website', 200) !== '') {
    redirectTo(THANK_YOU_PATH);
}

$formId = value('form_id', 40) ?: 'contacto';
$source = CONTACT_SOURCES[$formId] ?? CONTACT_SOURCES['contacto'];

$lead = [
    'name' => value('name', 200),
    'phone' => value('phone', 30),
    'email' => value('email', 320),
    'service' => value('service', 120),
    'message' => value('message', 5000),
];

if (
    $lead['name'] === '' ||
    $lead['phone'] === '' ||
    $lead['service'] === '' ||
    $lead['message'] === '' ||
    empty($_POST['consent'])
) {
    redirectTo(CONTACT_PATH . '?error=campos#lead-form');
}

if (!preg_match('/^[0-9+() .-]{6,30}$/', $lead['phone'])) {
    redirectTo(CONTACT_PATH . '?error=telefono#lead-form');
}

if ($lead['email'] !== '' && !filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) {
    redirectTo(CONTACT_PATH . '?error=campos#lead-form');
}

$digits = preg_replace('/\D+/', '', $lead['phone']) ?: '';
if (str_starts_with($digits, '0')) {
    $digits = '595' . substr($digits, 1);
}
$idempotencyKey = hash('sha256', $digits . '|' . gmdate('Y-m-d-H'));

$attr = [];
if (!empty($_COOKIE['vc_attr'])) {
    $decoded = json_decode(rawurldecode((string)$_COOKIE['vc_attr']), true);
    if (is_array($decoded)) {
        $attr = $decoded;
    }
}

// The converting page (this form_id/page) is kept separate from the CRM's
// landing_page semantics, which stays first-touch via the attribution cookie.
$convertingPage = value('page_url', 2000);

$payload = [
    'phone' => $lead['phone'],
    'name' => $lead['name'],
    'email' => $lead['email'],
    'message' => $lead['message'],
    'source' => $source,
    'page_url' => $attr['landing_page'] ?? $convertingPage,
    'referrer' => $attr['referrer'] ?? null,
    'utm_source' => $attr['utm_source'] ?? null,
    'utm_medium' => $attr['utm_medium'] ?? null,
    'utm_campaign' => $attr['utm_campaign'] ?? null,
    'utm_term' => $attr['utm_term'] ?? null,
    'utm_content' => $attr['utm_content'] ?? null,
    'gclid' => $attr['gclid'] ?? null,
    'fbclid' => $attr['fbclid'] ?? null,
    'fields' => array_filter([
        'servicio' => $lead['service'],
        'pagina' => $convertingPage,
        'zona' => value('zona', 200),
    ], static fn($item) => $item !== null && $item !== ''),
    'idempotency_key' => $idempotencyKey,
];
$payload = array_filter($payload, static fn($item) => $item !== null && $item !== '');

// --- Private secrets: one file for VenderCRM + Resend -----------------------
// Lookup order: env vars override; file path from POZO_CONFIG env, else
// dirname(DOCUMENT_ROOT)/private/pozo.php. Legacy private/vendercrm.php
// (VenderCRM only) is still honoured for a site upgraded from v1.
$privateConfig = [];
$documentRoot = (string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);

$pozoConfigPath = (string)(getenv('POZO_CONFIG') ?: dirname($documentRoot) . '/private/pozo.php');
if (is_readable($pozoConfigPath)) {
    $loadedConfig = require $pozoConfigPath;
    if (is_array($loadedConfig)) {
        $privateConfig = $loadedConfig;
    }
}

$legacyVenderCrmPath = (string)(getenv('VENDERCRM_CONFIG') ?: dirname($documentRoot) . '/private/vendercrm.php');
if (empty($privateConfig['vendercrm_url']) && empty($privateConfig['vendercrm_key']) && is_readable($legacyVenderCrmPath)) {
    $legacyConfig = require $legacyVenderCrmPath;
    if (is_array($legacyConfig)) {
        $privateConfig['vendercrm_url'] = $privateConfig['vendercrm_url'] ?? ($legacyConfig['url'] ?? null);
        $privateConfig['vendercrm_key'] = $privateConfig['vendercrm_key'] ?? ($legacyConfig['api_key'] ?? null);
    }
}

$crmUrl = rtrim((string)(getenv('VENDERCRM_URL') ?: ($privateConfig['vendercrm_url'] ?? $crmDefaultUrl)), '/');
$apiKey = (string)(getenv('VENDERCRM_API_KEY') ?: ($privateConfig['vendercrm_key'] ?? ''));

// The CRM URL must be https in production. The one exception: a local test
// server on 127.0.0.1 (php -S ... with VENDERCRM_URL pointing at a stub) may
// use http so the handler can be tested end to end without a real CRM.
$crmUrlHost = parse_url($crmUrl, PHP_URL_HOST);
$crmUrlScheme = parse_url($crmUrl, PHP_URL_SCHEME);
$isLocalTestHost = $crmUrlHost === '127.0.0.1' && $crmUrlScheme === 'http';
$validCrmUrl = filter_var($crmUrl, FILTER_VALIDATE_URL) && ($crmUrlScheme === 'https' || $isLocalTestHost);

$resendApiKey = (string)(getenv('RESEND_API_KEY') ?: ($privateConfig['resend_key'] ?? ''));
$resendFrom = (string)(getenv('RESEND_FROM') ?: ($privateConfig['resend_from'] ?? ''));
$resendApiBase = rtrim((string)(getenv('RESEND_API_BASE') ?: RESEND_API_BASE_DEFAULT), '/');
$notifyToEnv = getenv('LEAD_NOTIFY_TO');
$notifyTo = $notifyToEnv !== false
    ? array_values(array_filter(array_map('trim', explode(',', $notifyToEnv))))
    : (array)($privateConfig['notify_to'] ?? []);

$crmStatusLog = 'skipped';
$resendStatusLog = 'skipped';
$crmResultSummary = 'no enviado';

// --- [1] VenderCRM POST: try, never blocks the WhatsApp redirect -----------
if (!$validCrmUrl) {
    error_log('[pozo] VenderCRM skipped: CRM URL missing or not https.');
} elseif ($apiKey === '') {
    error_log('[pozo] VenderCRM skipped: no API key configured (env VENDERCRM_API_KEY or private/pozo.php).');
} elseif (!function_exists('curl_init')) {
    error_log('[pozo] VenderCRM skipped: PHP cURL extension unavailable.');
}
if ($validCrmUrl && $apiKey !== '' && function_exists('curl_init')) {
    $curl = curl_init($crmUrl . '/api/v1/leads');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Api-Key: ' . $apiKey,
            'Idempotency-Key: ' . $idempotencyKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $crmResponse = curl_exec($curl);
    $crmStatus = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $crmError = curl_error($curl);
    curl_close($curl);

    $crmStatusLog = (string)$crmStatus;

    if ($crmStatus === 200 || $crmStatus === 201) {
        $decodedCrm = json_decode((string)$crmResponse, true);
        if (is_array($decodedCrm)) {
            $contactId = $decodedCrm['contactId'] ?? $decodedCrm['contact_id'] ?? null;
            $dealId = $decodedCrm['dealId'] ?? $decodedCrm['deal_id'] ?? null;
            $crmResultSummary = 'contactId=' . ($contactId ?? '?') . ' dealId=' . ($dealId ?? '?');
        }
    } else {
        error_log(sprintf(
            '[pozo] VenderCRM lead failed [%d] response=%s curl=%s',
            $crmStatus,
            substr((string)$crmResponse, 0, 2000),
            substr($crmError, 0, 500)
        ));
    }
}

// --- [2] Resend notify: try, never blocks the WhatsApp redirect ------------
if ($resendApiKey === '' || empty($notifyTo)) {
    if ($resendApiKey === '') {
        error_log('[pozo] resend skipped: RESEND_API_KEY is empty');
    } else {
        error_log('[pozo] resend skipped: notify_to is empty');
    }
} elseif (!function_exists('curl_init')) {
    error_log('[pozo] resend skipped: PHP cURL extension is unavailable');
} else {
    $safeName = stripControlChars($lead['name']);
    $safeService = stripControlChars($lead['service']);
    $subject = stripControlChars(sprintf('Consulta: %s · %s', $safeService, $safeName));

    $waLink = 'https://wa.me/' . $digits;
    $textLines = [
        'Nueva consulta desde Pozo.com.py',
        '',
        'Nombre: ' . $safeName,
        'Teléfono: ' . $lead['phone'],
        'Servicio: ' . $safeService,
        'Mensaje: ' . stripControlChars($lead['message']),
    ];
    if ($lead['email'] !== '') {
        $textLines[] = 'Correo: ' . $lead['email'];
    }
    $textLines[] = 'Página: ' . $convertingPage;
    $textLines[] = 'Origen: ' . $source;
    $textLines[] = 'CRM: ' . $crmResultSummary;
    $textLines[] = 'WhatsApp: ' . $waLink;
    $textBody = implode("\n", $textLines);

    $htmlRows = [
        ['Nombre', $safeName],
        ['Teléfono', $lead['phone']],
        ['Servicio', $safeService],
        ['Mensaje', stripControlChars($lead['message'])],
    ];
    if ($lead['email'] !== '') {
        $htmlRows[] = ['Correo', $lead['email']];
    }
    $htmlRows[] = ['Página', $convertingPage];
    $htmlRows[] = ['Origen', $source];
    $htmlRows[] = ['CRM', $crmResultSummary];
    $htmlRowsMarkup = implode('', array_map(
        static fn($row) => '<tr><td><strong>' . htmlspecialchars($row[0], ENT_QUOTES, 'UTF-8') . '</strong></td><td>' . nl2br(htmlspecialchars($row[1], ENT_QUOTES, 'UTF-8')) . '</td></tr>',
        $htmlRows
    ));
    $htmlBody = '<table>' . $htmlRowsMarkup . '</table><p><a href="' . htmlspecialchars($waLink, ENT_QUOTES, 'UTF-8') . '">Abrir WhatsApp</a></p>';

    $resendPayload = array_filter([
        'from' => $resendFrom,
        'to' => $notifyTo,
        'reply_to' => ($lead['email'] !== '' && filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) ? $lead['email'] : null,
        'subject' => $subject,
        'text' => $textBody,
        'html' => $htmlBody,
    ], static fn($item) => $item !== null && $item !== '');

    $resendCurl = curl_init($resendApiBase . '/emails');
    curl_setopt_array($resendCurl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $resendApiKey,
            'Idempotency-Key: ' . $idempotencyKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($resendPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $resendResponse = curl_exec($resendCurl);
    $resendStatus = (int)curl_getinfo($resendCurl, CURLINFO_HTTP_CODE);
    $resendError = curl_error($resendCurl);
    curl_close($resendCurl);

    $resendStatusLog = (string)$resendStatus;

    if ($resendStatus !== 200) {
        error_log(sprintf(
            '[pozo] Resend notify failed [%d] response=%s curl=%s',
            $resendStatus,
            substr((string)$resendResponse, 0, 500),
            substr($resendError, 0, 500)
        ));
    }
}

// --- [3] Always end in WhatsApp with the enquiry prefilled ------------------
error_log(sprintf('[pozo] crm=%s resend=%s', $crmStatusLog, $resendStatusLog));
whatsappFallback($lead, $whatsappNumber);
