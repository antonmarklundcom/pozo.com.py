<?php
// Copy to domains/pozo.com.py/private/pozo.php  (OUTSIDE public_html). Never commit.
return [
    'vendercrm_url' => 'https://crm.clientes.com.py',
    'vendercrm_key' => '', // VenderCRM → Sitios → pozo.com.py → key (shown once)
    'resend_key' => '', // Resend → API Keys, "Sending access" only, restricted to domain pozo.com.py
    'resend_from' => 'Pozo.com.py <leads@pozo.com.py>',
    'notify_to' => [], // e.g. ['operador@...'] — the mailbox that must get every lead
    'reply_to_visitor' => false, // Phase 2: send the visitor a copy when they left an email
];
