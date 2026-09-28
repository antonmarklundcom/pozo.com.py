# Pozo.com.py v2 — plan and build guide

Written 2026-09-02 by Fable 5.1 (planning only, no site code changed yet).
Builders: Opus/Sonnet subagents. Final integration and verification: one agent, using section 10.

## 0. Folders and how to use this document

| Path | Role |
|---|---|
| `Paraguay-Local-Site/pozo-com-py/` | v1, frozen. Never edit. Use to diff and to roll back. |
| `Paraguay-Local-Site/pozo-com-py-v2/` | v2 working copy (exact copy of v1 made 2026-09-02, `node build.mjs` verified). All work happens here. |
| `Paraguay-Local-Site/pozo-com-py-hostinger-ready-2026-09-02.zip` | Target upload ZIP (produced by `tools/package.ps1` after the date constant is updated). |

Local tools verified on this machine: Node v24.16, PHP 8.4 CLI, Python 3.12.

Rules for every builder agent:

1. Source of truth is `build.mjs`, `site.config.mjs`, `assets/css/site.css`, `assets/js/site.js`, `contacto.php`, `tools/qa.mjs`. Generated HTML, `sitemap.xml`, `robots.txt`, `404.html` are never hand-edited.
2. After any change to build sources run `node build.mjs`, then the QA loop in section 10.
3. No framework, no npm dependencies, no remote runtime assets (the only remote script stays `vc-attribution.js` from the CRM). Self-hosted fonts are allowed (see 6.2).
4. Keep Paraguayan Spanish with voseo everywhere. Keep all guardrail wording listed in section 2.
5. Do not invent facts. Anything unknown stays "a confirmar" / "a cotizar".

## 1. Audit of v1 (what exists today)

Architecture, all good and to be preserved:

- 14 generated routes: `/`, `/servicios/`, 7 service pages (`artesiano`, `precio-pozo`, `pozo-ciego`, `desague`, `pozo-lleno`, `septico`, `agua`), 2 zone pages (`zonas/san-lorenzo`, `zonas/mra`), `/contacto/`, `/privacidad/`, `/gracias/` (noindex), plus `404.html` (noindex).
- Single generator `build.mjs` (416 lines) with `header()`, `footer()`, `serviceHero()`, `genericServicePage()`, `locationPage()`, `render()`. JSON-LD graph: ProfessionalService, Service, CollectionPage+ItemList, FAQPage, BreadcrumbList. Canonical, hreflang, OG, Twitter all present.
- `.htaccess`: HTTPS + non-www 301, legacy URL redirects, security headers, expires.
- `contacto.php`: POST only, honeypot, required fields + consent, phone regex, email validation, idempotency key `sha256(digits|YYYY-MM-DD-HH)`, `vc_attr` cookie attribution, VenderCRM POST with server-only key from env or `../private/vendercrm.php`, always ends in a WhatsApp redirect with the enquiry prefilled. Uses `str_starts_with` and `never` return type, so PHP 8.1+ is required on Hostinger.
- `tools/qa.mjs`: static checks (one H1, robots, canonical, JSON-LD parse, link targets, placeholders, image size) plus HTTP route checks against a local server.
- 8 WebP illustrations labelled "Imagen ilustrativa", sources in `source-images/`.

Weak points v2 must fix:

- Contact number is `595992279599` in `site.config.mjs`, hard-coded in `contacto.php` (`WHATSAPP_NUMBER`), hard-coded in `tools/qa.mjs` (two literals), and written literally in the services-hero button label in `build.mjs` ("Llamar al +595 992 279 599"). Four places, must become one.
- Floating WhatsApp control is a bare 58px circle with the text "WA" and one generic message. No options, no context.
- Display font stack is `"Arial Narrow", "Roboto Condensed", ...` which does not exist on Android or most Windows machines, so the condensed editorial look silently degrades to plain Arial. The premium hierarchy the CSS intends is not what most visitors see.
- Home hero H1 "Soluciones que llegan más profundo" is a slogan, not a decision. The first screen does not separate the urgent visitor (pozo rebalsado, tonight) from the project visitor (pozo artesiano, weeks).
- Mobile: hero actions split into a 2-column grid of full-width buttons with tiny padding, price table needs horizontal scroll, utility bar phone hidden under 700px, no sticky access to the phone.
- Header nav hides the WhatsApp button under 980px, so on mobile the only contact is the floating circle.
- No email notification at all. `leadEmail` is empty by design, so the operator only learns about leads via WhatsApp or the CRM.
- `page_url` in the CRM payload is taken from the cookie first, then the form, so the actual converting page is lost when the cookie exists. Keep `landing_page` in `page_url` per CRM semantics but also send the converting page in `fields.pagina`.
- Motion: only hover transforms. No reveal, no reduced-motion nuance beyond the global kill switch.
- `qa.mjs` `existsAsRoute` builds Windows paths with backslashes and the noindex check compares `gracias\index.html`, so the script is Windows-only. Acceptable, but note it.

## 2. Non-negotiables (guardrails carried from v1)

Copy these into every builder prompt.

- Contact number everywhere: `595995628862`, display `+595 995 628 862`, tel `+595995628862`, `https://wa.me/595995628862?text=...`. Zero occurrences of `595992279599` or `992 279 599` may remain in the repo except in this plan and `docs/`.
- No placeholder emails, prices, RUC, addresses, team names, reviews, guarantees, response times, "24/7", "gratis", "potable", or "servicio garantizado". Prices stay `A cotizar` while `PRICES` values are `null`.
- Hours wording stays exactly: "Lun a Sáb 07:00–19:00 · Urgencias de desagüe, también domingo" and every Sunday mention keeps "sujetas a disponibilidad".
- Illustrations keep the visible "Imagen ilustrativa" label and the footer editorial note. Never phrase imagery as proof of a real truck, crew or job.
- Privacy page, consent checkbox, honeypot, server-side flow, first-touch attribution and CRM key handling stay. Keys live only in env vars or `domains/pozo.com.py/private/…`, never in the repo or ZIP.
- Public pages `index,follow`; only `/gracias/` and `404.html` are noindex.
- No new dependencies. Node is a local build tool only.

## 3. Configuration changes (site.config.mjs)

```js
export const SITE = {
  name: 'Pozo.com.py',
  url: 'https://pozo.com.py',
  tagline: 'Pozos artesianos y desagüe de pozos ciegos en Paraguay',
  city: 'Asunción', region: 'Capital', country: 'PY',
  languages: ['es-PY', 'gn'],
  hoursText: 'Lun a Sáb 07:00–19:00 · Urgencias de desagüe, también domingo',
  whatsapp: '595995628862',
  phoneDisplay: '+595 995 628 862',
  phoneHref: '+595995628862',
  leadEmail: '',                 // public display only; stays empty until a mailbox is verified
  venderCrmUrl: 'https://crm.clientes.com.py',
  capacity: '8 m³',
  assetVersion: '20260902-1',   // NEW: replaces the hard-coded ?v= strings in render()
};
```

Also add `export const LAUNCHER_OPTIONS` (section 5.3) and `export const CONTACT_SOURCES` (section 4.4) to the config so copy and routing live in one place.

`contacto.php` must stop hard-coding the number. Add a generated file `config/site.generated.php` written by `build.mjs` (a `return [...]` array with `whatsapp`, `site_url`, `crm_url`) and `require` it from `contacto.php`. Add `config/` to the packaging lists in both `tools/package.ps1` and `tools/package-hostinger.py`, and add an `.htaccess` rule denying direct web access to `/config/`. This is the only way the number lives in one file.

## 4. Contact stack: VenderCRM + Resend

### 4.1 Flow (server-side, in contacto.php)

```
POST /contacto.php
  → honeypot? → 303 /gracias/ (nothing else)
  → validate (name, phone, service, message, consent, optional email)
  → build lead + attribution
  → [1] VenderCRM POST  (try, 10 s timeout, never blocks)
  → [2] Resend notify   (try, 6 s timeout, never blocks)
  → [3] 303 → wa.me with the enquiry prefilled  (always)
```

Every step logs with `error_log('[pozo] crm=... resend=...')` so Hostinger's error log tells the truth. The visitor always ends in WhatsApp. Order matters: CRM first so a Resend outage cannot delay the CRM write.

### 4.2 Private secrets file (one file for both services)

Rename the example to `docs/pozo-private.example.php` and keep the old example name as a one-line pointer:

```php
<?php
// Copy to domains/pozo.com.py/private/pozo.php  (OUTSIDE public_html). Never commit.
return [
  'vendercrm_url'   => 'https://crm.clientes.com.py',
  'vendercrm_key'   => '',   // VenderCRM → Sitios → pozo.com.py → key (shown once)
  'resend_key'      => '',   // Resend → API Keys, "Sending access" only, restricted to domain pozo.com.py
  'resend_from'     => 'Pozo.com.py <leads@pozo.com.py>',
  'notify_to'       => [],   // e.g. ['operador@…'] — the mailbox that must get every lead
  'reply_to_visitor'=> false // Phase 2: send the visitor a copy when they left an email
];
```

Lookup order in PHP: env vars (`VENDERCRM_URL`, `VENDERCRM_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `LEAD_NOTIFY_TO` comma-separated) override the file; the file path comes from `getenv('POZO_CONFIG')` or `dirname(DOCUMENT_ROOT).'/private/pozo.php'`. Keep reading the legacy `private/vendercrm.php` too so an existing Hostinger setup keeps working.

Hard rule: if `resend_key` or `notify_to` is empty, the email step is skipped silently with one log line. The site must work with no keys at all (WhatsApp fallback), exactly like v1.

### 4.3 Resend call (PHP, cURL, no SDK)

```
POST https://api.resend.com/emails
Authorization: Bearer <resend_key>
Content-Type: application/json
Idempotency-Key: <same idempotency key as the CRM call>
{
  "from": "Pozo.com.py <leads@pozo.com.py>",
  "to": ["..."],
  "reply_to": "<visitor email if valid, else omitted>",
  "subject": "Consulta: {servicio} · {ciudad si se detecta} · {nombre}",
  "text": "...plain text with all fields, page, attribution and CRM result (contactId/dealId or 'no enviado')...",
  "html": "...same, minimal table, no external images..."
}
```

- Success = HTTP 200 with an `id`. Anything else: log status and first 500 chars of the body.
- Resend's own `Idempotency-Key` header stops double emails on a double submit. Use the CRM key so both systems agree.
- Subject must never contain raw newlines; strip control characters from every field before building the email.
- All visitor text is HTML-escaped in the `html` part.
- The `text` part includes the WhatsApp deep link to the visitor number (`https://wa.me/<digits>`) so the operator can answer from the mail on the phone.

### 4.4 Sources and the launcher

`CONTACT_SOURCES` whitelist in config maps `form_id` → CRM `source`:

| form_id | source |
|---|---|
| `contacto` | `site:pozo.com.py:contacto` |
| `ficha` | `site:pozo.com.py:ficha-rapida` (launcher mini-form, section 5.6) |

Unknown `form_id` falls back to `contacto`. Add `fields.pagina` (the converting page URL) and `fields.zona` (if the ficha collected it) to the CRM payload. Keep `page_url` = landing page from the cookie, as the CRM defines it.

### 4.5 Privacy page additions (Spanish, verbatim)

In "Proveedores y canales" replace the second sentence with:

> El formulario puede enviar la solicitud a nuestro sistema de gestión comercial y generar un aviso por correo electrónico a través de un proveedor de envío transaccional. WhatsApp, el proveedor de correo y el proveedor de alojamiento procesan información bajo sus propias condiciones. Solamente compartimos los datos necesarios para operar estos canales y atender el pedido.

Update "Última actualización" to the build date.

### 4.6 Live gates (Anton, not the builder)

1. VenderCRM: create the site `pozo.com.py` in Sitios at `crm.clientes.com.py`, set default pipeline stage, copy the key once.
2. Resend: add domain `pozo.com.py`, put the DKIM/SPF/MX records it shows into Hostinger hPanel → DNS for pozo.com.py, wait for "Verified". Create an API key with sending access only. Until verified only `onboarding@resend.dev` → the account owner's mailbox works, which is fine for the first test.
3. Decide `notify_to`. This is the operator's real mailbox. `leadEmail` on the public site stays empty unless the operator wants it published.
4. Upload `private/pozo.php` to `domains/pozo.com.py/private/`, PHP 8.1+ selected in hPanel.
5. Test: one real form submit → contact in Contactos with `+595…`, deal in Pipeline, count in Sitios, email received, WhatsApp opened with the prefilled text. Submit the same form again within the hour → no duplicate contact, no duplicate email.

## 5. WhatsApp launcher and header contact control

### 5.1 Behaviour

- One launcher panel per page, generated by a new `launcher(page)` function in `build.mjs`, included on all 14 routes and on `404.html`.
- Desktop: fixed bottom-right FAB (60px, green `#25d366` on the brand ink ring) opens a 340px popover above it. Tablet/mobile: FAB 56px, panel becomes a bottom sheet (full width, max-height 80vh, scrollable, 48px+ rows).
- Header: a `contact-toggle` control on the right of the nav (desktop and mobile), icon + label "Contacto" on desktop, icon only with `aria-label` on mobile. It opens the same panel. It sits left of the hamburger on mobile so the two controls never overlap.
- Works without JavaScript: the FAB is the `<summary>` of a `<details id="wa-launcher">`. Native keyboard toggling, no JS needed. The header control without JS is a plain `<a href="#wa-launcher">` that scrolls to the open panel target; JS upgrades it into a `<button aria-expanded aria-controls="wa-launcher">` that toggles the same `<details>`.
- JS enhancements: Escape closes, click outside closes, focus moves to the first option on open and back to the trigger on close, `aria-expanded` mirrored on both triggers, body scroll locked while the mobile sheet is open, the panel remembers nothing (no storage).
- Every option is an `<a target="_blank" rel="noopener noreferrer" href="https://wa.me/595995628862?text=…">` built with `encodeURIComponent`. Newlines are `%0A`. Test each URL decodes cleanly.
- A last row inside the panel shows the phone `tel:` link and the hours line, so the launcher is also the phone entry point on mobile.

### 5.2 Markup (generated)

```html
<details class="wa-launcher" id="wa-launcher">
  <summary class="wa-launcher__fab" aria-label="Abrir opciones de contacto por WhatsApp">
    <svg …WhatsApp glyph… aria-hidden="true"></svg><span class="wa-launcher__fab-label">WhatsApp</span>
  </summary>
  <div class="wa-launcher__panel" role="dialog" aria-labelledby="wa-launcher-title">
    <header><p class="eyebrow">Escribinos por WhatsApp</p><h2 id="wa-launcher-title">¿Qué necesitás resolver?</h2><button type="button" class="wa-launcher__close" hidden>Cerrar</button></header>
    <ul class="wa-launcher__list">
      <li><a class="wa-option wa-option--urgent" href="…"><strong>Desagüe urgente / pozo rebalsado</strong><span>Camión atmosférico, hoy si hay disponibilidad</span></a></li>
      <li><a class="wa-option" href="…"><strong>Cotizar pozo artesiano</strong><span>Perforación, entubado, bomba y tablero</span></a></li>
      <li><a class="wa-option" href="…"><strong>Consulta por pozo ciego o séptico</strong><span>Construcción, mantenimiento, biodigestor</span></a></li>
      <li><a class="wa-option" href="…"><strong>Tratamiento / análisis de agua</strong><span>Sarro, hierro, color, cloración</span></a></li>
      <li><a class="wa-option" href="…"><strong>Hablar sobre otro caso</strong><span>Contanos qué pasa y dónde</span></a></li>
    </ul>
    <footer><a href="tel:+595995628862">Llamar al +595 995 628 862</a><span>Lun a Sáb 07:00–19:00 · Urgencias de desagüe, también domingo</span><a href="/contacto/">Dejar mis datos en el formulario</a></footer>
  </div>
</details>
```

The `wa-launcher__close` button is `hidden` until JS removes the attribute.

### 5.3 Messages (LAUNCHER_OPTIONS in site.config.mjs)

Each option has `id`, `label`, `hint`, `urgent`, and a `message(ctx)` template. `ctx = { pageLabel, zone }` where `pageLabel` is the page's `short` and `zone` is the city for zone pages, else empty. All messages end with a context line `Vi pozo.com.py – {pageLabel}.` so the operator knows where the click came from.

```
urgente:  Hola, necesito un desagüe urgente. Mi pozo ciego está lleno o rebalsando.
          Ciudad/barrio: {zone|___}
          ¿Puede entrar un camión hasta el pozo?: ___
          Vi pozo.com.py – {pageLabel}.

artesiano: Hola, quiero cotizar un pozo artesiano.
          Ciudad/barrio: ___
          Uso del agua (casa, comercio, riego, obra): ___
          Profundidad estimada, si la conozco: ___
          Vi pozo.com.py – {pageLabel}.

ciego:    Hola, tengo una consulta por pozo ciego o sistema séptico.
          Ciudad/barrio: ___
          Qué pasa o qué necesito: ___
          Vi pozo.com.py – {pageLabel}.

agua:     Hola, quiero consultar por tratamiento o análisis de agua de pozo.
          Ciudad/barrio: ___
          Problema (sarro, hierro, color, olor): ___
          ¿Tengo análisis?: ___
          Vi pozo.com.py – {pageLabel}.

otro:     Hola, quiero hablar sobre otro caso.
          Ciudad/barrio: ___
          Qué necesito: ___
          Vi pozo.com.py – {pageLabel}.
```

### 5.4 Context-aware CTAs on every page

`cta()` already takes a message per call. v2 rule: every page-level CTA names the service and, when known, the zone, and ends with the same `Vi pozo.com.py – {pageLabel}.` line. Add a helper `waMessage(kind, ctx)` in `build.mjs` that both the launcher and the page CTAs use, so wording never drifts. Home hero gets two CTAs: primary urgent (`urgente`) and secondary project (`artesiano`).

### 5.5 Header control markup

```html
<a class="contact-toggle" href="#wa-launcher" data-launcher-trigger>
  <svg …chat glyph… aria-hidden="true"></svg><span>Contacto</span>
</a>
```

JS replaces the `<a>` with a `<button type="button" class="contact-toggle" aria-expanded="false" aria-controls="wa-launcher">` on load (keep the inner markup). Min size 48×48 on all breakpoints.

### 5.6 Ficha rápida (Phase 2, optional)

A sixth row "Dejar teléfono y que te escriban" expands an inline mini-form inside the panel: phone (required), one select of the same five cases, consent checkbox, hidden `form_id=ficha`, hidden `page_url`. It posts to `contacto.php`, which stores the lead in the CRM, sends the Resend mail and continues to WhatsApp. This is the only way a launcher interaction becomes a CRM contact, because a direct wa.me click never reveals the visitor's number. Ship it only after the five direct options are verified.

## 6. Design system v2

Direction: premium, practical, Paraguayan. The visual idea is the geological cross-section: the site reads top-down like a well profile. Dark ink surface at the top, sand and paper strata in the middle, water at the bottom CTA. The depth ruler already hints at this; v2 makes it the organising device.

### 6.1 Tokens (site.css `:root`)

```
--ink: #0b2731      --ink-2: #143b47     --ink-3: #1d4a58
--water: #0e7183    --water-light: #9cd7dc  --water-deep: #0a5563
--clay: #c5673d     --clay-dark: #a1512c    (urgent/action)
--sand: #eee6d8     --sand-2: #e4d9c4       --paper: #f7f5ef   --white: #fff
--wa: #25d366       --wa-dark: #128c7e
--muted: #5d6a6c    --line: rgba(11,39,49,.16)
--radius: 4px  (the brand is square-ish, keep radii tiny; only the FAB and chips are round)
--shell: min(1180px, calc(100vw - 40px))   mobile: calc(100vw - 32px)
--tap: 48px
```

Contrast rule: every text/background pair ≥ 4.5:1, muted text on sand must be `#4a5759` or darker. `--clay` on white is 4.6:1 for large bold text only; body text never in clay.

### 6.2 Typography (self-hosted, no remote requests)

- Display: **Barlow Condensed** 600/700/800 (OFL). Body: **Inter** variable or 400/600/700 (OFL). Builder downloads the woff2 files once (latin subset only, 5 files, ~120 KB total) into `assets/fonts/` and declares `@font-face` with `font-display: swap`. Add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the display 700 and body 400 in `render()`. Add `font/woff2` to the `.htaccess` expires block (1 year).
- Fallback stacks: display → `"Arial Narrow", Impact, "Franklin Gothic Medium", sans-serif`; body → `system-ui, Segoe UI, Roboto, sans-serif`. Use `size-adjust` in the fallback `@font-face` to reduce layout shift.
- Scale: h1 `clamp(2.6rem, 6.5vw, 5.6rem)` (down from 6.7rem; v1 headings overflow 360px), h2 `clamp(2rem, 4vw, 3.6rem)`, h3 `1.35rem`, body 16px/1.65, mobile body 16px (v1 dropped to 15px; keep 16 for readability). Line-height for display .98, letter-spacing -.02em. Eyebrows 0.72rem uppercase, tracking .14em.

### 6.3 Motion

- Reveal on scroll via `IntersectionObserver` adding `.is-in` (opacity 0→1, translateY 14px→0, 420ms, ease-out). Elements are visible by default when JS is absent (`html:not(.js) .reveal { opacity:1 }`).
- Header compacts after 24px scroll (padding shrinks, shadow appears).
- Launcher: panel scale/fade 180ms from the FAB corner; sheet slides up 220ms.
- Depth ruler: subtle 1px marker that moves with scroll progress on the home hero (transform only).
- `prefers-reduced-motion`: keep v1's global kill, plus reveal elements render instantly.
- No parallax, no autoplay video, no looping animation.

### 6.4 Components to add or rework

- `.decision-hero` (home): two-path hero, section 7.1.
- `.path-card`: large tappable card with icon, title, one line, arrow. Used for the urgent/project split and the symptom list.
- `.wa-launcher`, `.wa-option`, `.contact-toggle` (section 5).
- `.strata` background utility: 3 horizontal bands with 1px lines suggesting soil layers, used as section dividers between ink → sand → paper.
- `.stat` fact strip rebuilt as 4 cards on desktop, 2×2 on mobile, with source-safe wording (unchanged claims).
- `.price-table` responsive: on ≤700px render each row as a card (`display:grid` per `tr`, `td::before` labels) so there is no horizontal scroll.
- `.side-panel` becomes a sticky "Datos para consultar" checklist with the contextual WA CTA and the phone link.
- `.trust-bar` (new, factual only): "Imágenes ilustrativas · Presupuesto antes de coordinar · Sin costo oculto: se confirma cada visita". No fake badges.
- Buttons: min-height 50px, mobile full width in heroes, `.button--wa` variant (WhatsApp green with the glyph) for direct WA actions, `.button--primary` (clay) reserved for the urgent path and form submit.

## 7. Page-by-page

### 7.1 Home `/`

1. Header + utility bar (utility bar shows hours; phone shown on all widths, truncated to the number only on mobile).
2. Decision hero. Eyebrow "Agua · saneamiento · Gran Asunción". H1 "Pozos artesianos y desagüe de pozos ciegos en Gran Asunción" (keyword H1 replaces the slogan; the slogan can survive as a small kicker). Below it two path cards side by side (stacked on mobile):
   - Urgent (clay): "Pozo lleno o rebalsando" → "Pedir desagüe ahora" (WA `urgente`) + small "Qué hacer mientras esperás →" link to `/servicios/pozo-lleno/`.
   - Project (water): "Quiero mi propio pozo" → "Cotizar pozo artesiano" (WA `artesiano`) + "Ver cómo se cotiza →" to `/servicios/precio-pozo/`.
   Background: illustration with the layered gradient, "Imagen ilustrativa" label, depth ruler on desktop. Microcopy under the cards keeps the Sunday wording.
3. Fact strip (same four facts, card layout).
4. Services grid (6 cards, image + title + one line + arrow). Keep order.
5. "¿No sabés qué servicio pedir?" symptom router (ink section) → path cards.
6. Process (4 steps) with the sticky copy and the "Describir mi caso" CTA.
7. Price concept table (responsive cards on mobile, `A cotizar` pills).
8. Coverage (place cloud + coverage card).
9. FAQ (details, unchanged copy).
10. Closing CTA (water) with launcher-consistent two buttons: WhatsApp + Llamar.

### 7.2 `/servicios/`

Keep structure. Hero gets the two-button pattern (WA + tel). Cards 3-up → 2-up → 1-up. Support section stays (calculadora + zonas).

### 7.3 Service pages (artesiano, pozo-ciego, desague, pozo-lleno, septico, agua)

Keep `genericServicePage()` shape: breadcrumb, hero (copy + 16:9 illustration, `qa.mjs` enforces this), article + sticky side panel, FAQ, closing CTA. Changes:

- Hero actions: `button--wa` "Consultar por WhatsApp" (page message), `text-link` "Llamar", anchor "Ver detalles".
- `pozo-lleno` gets an "Ahora mismo" red-line box at the top of the article with the 5 safety steps and the urgent WA button, above the fold on mobile.
- `desague` gets a "Qué mandar por WhatsApp" strip: three chips (foto del acceso, foto de la tapa, distancia en pasos) linking to the WA message.
- `precio-pozo`: calculator stays; "Copiar solicitud" gains a second button "Enviar por WhatsApp" that opens wa.me with the same text (JS), and a no-JS fallback link with a generic cotización message.
- Side panel CTA uses the page message; below it the phone link.

### 7.4 Zone pages (san-lorenzo, mra)

Same template. `ctx.zone` is prefilled in the launcher and CTAs ("Ciudad/barrio: San Lorenzo"). Optional Phase 3: add `luque`, `capiata`, `lambare`, `fernando-de-la-mora` only with genuinely different local content (access corridors, typical lot/street situations, nearby references). No thin duplicates; if the builder cannot write distinct content, skip.

### 7.5 `/contacto/`

- Hero: "Contanos qué necesitás y dónde." keep.
- Replace the two-column "Canales / Cobertura" with: left = the five launcher options rendered inline as `.wa-option` rows (same hrefs) + phone + hours; right = form. Coverage moves below the form.
- Form: keep all fields and names (`name`, `phone`, `email`, `service`, `message`, `consent`, `website`, `form_id`, `page_url`). Add `autocomplete`, `inputmode`, inline error text driven by `?error=` (already), and the button label "Enviar y continuar en WhatsApp" (qa.mjs checks this string). Under the button: "Registramos la consulta, avisamos al equipo y abrimos WhatsApp con tu mensaje."

### 7.6 `/gracias/`, `404.html`, `/privacidad/`

Gracias: keep noindex, add the launcher and the "Escribir por WhatsApp" button. 404: generated from the same `render()` path (currently a separate template string); refactor so 404 uses `render()` with `noindex: true, excludeSitemap: true` and no canonical, so it gets the launcher, fonts and header automatically. Privacidad: section 4.5 text.

## 8. Engineering task list (by file)

`site.config.mjs`
- New number, `assetVersion`, `LAUNCHER_OPTIONS`, `CONTACT_SOURCES`.

`build.mjs`
- Import new config exports. Add `waMessage(kind, ctx)`, `launcher(page)`, `contactToggle()`, `pathCard()`, `priceRows()` card-mode markup, `svg(name)` inline icon helper (WhatsApp glyph, phone, chat, arrow, alert, drop). Icons are inline SVG strings in one `icons` object.
- Home page rebuilt per 7.1. Service pages per 7.3. Contact per 7.5. 404 through `render()`.
- `render()`: font preloads, `assetVersion` in `?v=`, launcher before the scripts, `data-page-label` on `<body>`.
- Remove the literal phone from the services-hero label: `phoneLink(\`Llamar al ${SITE.phoneDisplay}\`, ...)`.
- Write `config/site.generated.php` (number, site URL, CRM URL) at build time.
- Every generated `wa.me` URL is built by `whatsappLink()` only.

`assets/css/site.css`
- Tokens, fonts, scale, launcher, contact toggle, path cards, strata, responsive price table, reveal/scrolled states, focus rings on dark backgrounds (white 3px outline on ink sections), 48px targets, no horizontal overflow at 360/390/768/1024/1440.

`assets/js/site.js`
- Keep attribution cookie, menu, submenu, calculator, form status. Add: launcher controller (5.1), header toggle upgrade (5.5), reveal observer, scrolled header, calculator "Enviar por WhatsApp". Wrap everything in an IIFE, no globals. Must degrade: if JS fails, `<details>` still works.

`contacto.php`
- Require `config/site.generated.php`. Load private config per 4.2. Resend step per 4.3. `form_id` → source per 4.4. `fields.pagina`. Structured `error_log`. Keep PHP 8.1 compatibility (no 8.2+ only syntax). Keep every existing guard.

`.htaccess`
- Deny `/config/` and `/source-images/` and `/tools/` and `/docs/` from the web (`RedirectMatch 404`), woff2 expires, keep everything else.

`tools/qa.mjs`
- Read the number from `site.config.mjs` instead of literals. Fail on any `595992279599`. Assert the launcher exists with exactly 5 `.wa-option` links per HTML file (6 with ficha), each `href` starts with `https://wa.me/595995628862?text=` and decodes without `%` errors. Assert `contact-toggle` in every page. Assert `rel="noopener"` on every `target="_blank"`. Assert `config/site.generated.php` contains the number. Assert `contacto.php` contains `api.resend.com`, `Idempotency-Key`, `RESEND_API_KEY` and no `re_[A-Za-z0-9]{20,}` literal. Assert no `assets/fonts` file is referenced that does not exist.

`tools/package.ps1`, `tools/package-hostinger.py`
- Add `config` to deploy dirs. Exclude `docs`, `source-images`, `tools`. ZIP name `pozo-com-py-hostinger-ready-2026-09-02.zip`. Forward-slash entries only (both scripts already do this).

`README.md`, `docs/`
- Update the number, the private file name, the Resend section, the launch checklist. Keep `HIGGSFIELD-IMAGE-PROMPTS.md`.

## 9. Execution plan and model assignment

Run phases in order. Each phase ends with `node build.mjs` + `node tools/qa.mjs` green (start a local server first: `python -m http.server 8765` from the v2 folder, or `php -S 127.0.0.1:8765` which also lets you POST to `contacto.php`).

| Phase | Scope | Model | Why |
|---|---|---|---|
| 1 | Config + number everywhere, `config/site.generated.php`, `contacto.php` Resend + sources, private example, privacy text, qa.mjs number/launcher/resend assertions, packaging lists, `.htaccess` deny rules | Sonnet | Mechanical, well specified, testable |
| 2 | Launcher + header contact toggle: build.mjs `launcher()`, `waMessage()`, CSS, JS, 404 through `render()` | Opus | Accessibility and no-JS/JS dual behaviour need judgement |
| 3 | Design system v2: fonts, tokens, scale, components, home decision hero, service page changes, contact page, responsive price table, motion | Opus | Visual quality is the point of v2 |
| 4 | Parallel QA: (a) responsive/a11y pass in the browser at 360/390/768/1024/1440, (b) SEO/link/schema audit, (c) PHP handler test with `php -S` and a stub CRM/Resend (env `VENDERCRM_URL=http://127.0.0.1:9999` pointing at a tiny local listener) | Sonnet ×3 in parallel | Bounded, checklist driven |
| 5 | Integration, fixes from phase 4, final build, ZIP, report | Fable (or Opus) | One owner for the final state |

Subagent prompt skeleton (paste sections 0, 2 and the phase's rows of section 8 verbatim, plus the relevant spec section):

```
You are working ONLY in C:\Users\anton\Documents\Paraguay-Local-Site\pozo-com-py-v2.
Read docs/PLAN-V2.md sections 0, 2 and <N> first. Do not edit generated HTML.
Make the changes listed under "<file>" in section 8 for phase <P>.
Then run: node build.mjs ; python -m http.server 8765 (background) ; node tools/qa.mjs
Report: files changed, QA output verbatim, anything you could not do and why.
```

Phase 3 additionally loads the `frontend-design` skill and the `py-onepager-image-pipeline` skill (for the WhatsApp button contrast rule).

## 10. Verification checklist (final agent)

Build and static
- `node build.mjs` → "Built 14 pages" (15+ if zones added). `node tools/qa.mjs` green.
- `grep -r "595992279599\|992 279 599" --exclude-dir=docs .` returns nothing.
- Every `wa.me` link: number `595995628862`, `text=` decodes to the expected Spanish, contains the page label.
- `sitemap.xml` lists every indexable route once, none noindex. `robots.txt` unchanged shape.
- JSON-LD on every page parses; `telephone` is `+595 995 628 862`.
- `.htaccess`: `/config/`, `/docs/`, `/tools/`, `/source-images/` return 404 under `php -S` with the router or on Hostinger.

PHP handler (`php -S 127.0.0.1:8765` in the v2 folder)
- GET `/contacto.php` → 405.
- POST with honeypot filled → 303 `/gracias/`, no CRM/Resend attempt in the log.
- POST missing consent → 303 `/contacto/?error=campos#lead-form`.
- POST bad phone → `?error=telefono`.
- POST valid, no keys → 303 to `wa.me` with the enquiry, log says `crm=skipped resend=skipped`.
- POST valid with `VENDERCRM_URL` pointing at a local stub returning 201 and `RESEND_API_KEY=test` with a stubbed Resend host (make the Resend base URL overridable by env `RESEND_API_BASE` for tests only, default `https://api.resend.com`) → both calls logged, 303 to WhatsApp.
- Same POST twice → identical idempotency key in both logs.

Browser (Claude Browser pane, `http://127.0.0.1:8765`)
- 360, 390, 768, 1024, 1440: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), hero readable, headings not clipped, launcher and header toggle visible and not overlapping the hamburger.
- Keyboard: Tab reaches the header toggle and the FAB; Enter opens; Escape closes; focus returns. Screen-reader names present.
- With JS disabled (`javascript_tool` cannot disable it; instead load the page with `?nojs` and a build flag that omits the script tag, or check the `<details>` toggles by clicking the summary before scripts run): the summary opens the panel.
- Tap targets: every `.wa-option`, `.contact-toggle`, `.menu-toggle`, form control ≥ 48px tall (measure with `getBoundingClientRect`).
- Contrast: spot-check muted text on sand and clay button text with computed colours.
- `prefers-reduced-motion: reduce` emulated: no transitions, reveal elements visible.
- Console: zero errors on every route.
- Screenshots: home 390 and 1440, launcher open on both, contact page 390, pozo-lleno 390.

Package
- Update the date in `tools/package.ps1`, run it, list ZIP entries, assert no `\` in entry names and no `docs/`, `tools/`, `source-images/`, `private` entries, and that `config/site.generated.php` is present.

Final report must contain: what changed, files changed, tests run with outputs, remaining live gates (section 4.6), ZIP path.

## 11. Open decisions for Anton (answer any time, defaults apply)

1. Display grouping of the number: this plan uses `+595 995 628 862`. If you prefer `+595 995 628862` as written, change `phoneDisplay` only.
2. Operator mailbox for `notify_to` (needed before Resend can be tested end to end).
3. Whether to publish an email on the site (`leadEmail`). Default: no.
4. Phase 2 ficha rápida and Phase 3 extra zone pages: default is to build the ficha, skip extra zones unless distinct local content is available.
