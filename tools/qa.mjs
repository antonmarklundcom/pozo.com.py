import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../site.config.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] || 'http://127.0.0.1:8765';
const failures = [];

const NUMBER = SITE.whatsapp;
const NUMBER_DISPLAY = SITE.phoneDisplay;
// Retired v1 number, stored reversed so this file's own source never contains
// the literal digit sequence it is scanning for (a grep for the old number
// across the whole repo would otherwise flag this file itself).
const OLD_NUMBER = '268826599595'.split('').reverse().join('');
const OLD_NUMBER_SPACED = '268 826 599 595'.split('').reverse().join('');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const allFiles = await walk(root);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
const titles = new Set();

function existsAsRoute(urlPath) {
  const clean = urlPath.split(/[?#]/)[0];
  if (!clean || clean === '/') return allFiles.includes(join(root, 'index.html'));
  const diskPath = join(root, clean.replace(/^\//, '').replace(/\//g, '\\'));
  return allFiles.includes(diskPath) || allFiles.includes(join(diskPath, 'index.html'));
}

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const relative = file.slice(root.length + 1);
  const intentionallyNoindex = relative === '404.html' || relative === 'gracias\\index.html';
  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count !== 1) failures.push(`${relative}: expected one H1, found ${h1Count}`);
  if (!/<meta name="viewport"/.test(html)) failures.push(`${relative}: missing viewport`);
  if (intentionallyNoindex && !/<meta name="robots" content="noindex/.test(html)) failures.push(`${relative}: should remain noindex`);
  if (!intentionallyNoindex && !/<meta name="robots" content="index,follow">/.test(html)) failures.push(`${relative}: public page is not indexable`);
  if (/demo-banner|sitio en preparación|no publicar todavía/i.test(html)) failures.push(`${relative}: contains preparation UI`);
  if (/595981234567|leads@pozo\.com\.py|correo por configurar|buzón pendiente|\[(?:RESPONSABLE|CORREO|DOMICILIO)/i.test(html)) failures.push(`${relative}: contains unverified placeholder content`);
  if (relative !== '404.html') {
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1] || '';
    if (title.length > 60) failures.push(`${relative}: title exceeds 60 characters`);
    if (description.length > 155) failures.push(`${relative}: description exceeds 155 characters`);
    if (titles.has(title)) failures.push(`${relative}: duplicate title`);
    titles.add(title);
    if (!/<link rel="canonical" href="https:\/\/pozo\.com\.py/.test(html)) failures.push(`${relative}: missing canonical`);
    if (!html.includes(NUMBER) || !html.includes(NUMBER_DISPLAY)) failures.push(`${relative}: configured contact number missing`);
    const jsonBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (!jsonBlocks.length) failures.push(`${relative}: missing JSON-LD`);
    for (const block of jsonBlocks) {
      try { JSON.parse(block[1]); } catch (error) { failures.push(`${relative}: invalid JSON-LD (${error.message})`); }
    }
  }
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (!existsAsRoute(match[1])) failures.push(`${relative}: broken internal target ${match[1]}`);
  }
}

const servicesHtml = await readFile(join(root, 'servicios', 'index.html'), 'utf8');
if (!servicesHtml.includes('"@type":"CollectionPage"') || !servicesHtml.includes('"@type":"ItemList"')) {
  failures.push('servicios/index.html: services collection schema missing');
}

const serviceHeroImages = {
  'artesiano': 'pozo-artesiano-servicio.webp',
  'pozo-ciego': 'pozo-septico-instalacion.webp',
  'desague': 'desague-pozo-ciego-camion.webp',
  'pozo-lleno': 'pozo-ciego-lleno-inspeccion.webp',
  'septico': 'pozo-septico-instalacion.webp',
  'agua': 'tratamiento-agua-filtros.webp',
};

for (const [slug, image] of Object.entries(serviceHeroImages)) {
  const serviceHtml = await readFile(join(root, 'servicios', slug, 'index.html'), 'utf8');
  const imagePath = `/assets/images/${image}`;
  if (!serviceHtml.includes(`class="hero-media"><img src="${imagePath}"`)) {
    failures.push(`servicios/${slug}/index.html: expected hero image ${image}`);
  }
  if (!servicesHtml.includes(imagePath)) {
    failures.push(`servicios/index.html: overview is missing ${image}`);
  }
}

const css = await readFile(join(root, 'assets', 'css', 'site.css'), 'utf8');
if (!/\.hero-media\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s.test(css)) {
  failures.push('assets/css/site.css: service hero media must keep a 16:9 ratio');
}

const contactHtml = await readFile(join(root, 'contacto', 'index.html'), 'utf8');
if (!/<form[^>]+action="\/contacto\.php"[^>]+method="POST"/.test(contactHtml)) {
  failures.push('contacto/index.html: server-side lead form is not configured');
}
if (!/name="phone"[^>]+required/.test(contactHtml) || !/name="website"/.test(contactHtml) || !/name="consent"/.test(contactHtml)) {
  failures.push('contacto/index.html: phone, honeypot or consent control missing');
}

const contactHandler = await readFile(join(root, 'contacto.php'), 'utf8');
for (const required of [
  'VENDERCRM_URL', 'VENDERCRM_API_KEY', '/api/v1/leads', 'idempotency_key', 'X-Api-Key',
  'api.resend.com', 'Idempotency-Key', 'RESEND_API_KEY',
]) {
  if (!contactHandler.includes(required)) failures.push(`contacto.php: missing ${required}`);
}
for (const required of ['https://crm.clientes.com.py', '/private/vendercrm.php', '/private/pozo.php', 'whatsappFallback($lead,']) {
  if (!contactHandler.includes(required)) failures.push(`contacto.php: missing secure VenderCRM/WhatsApp flow ${required}`);
}
if (/vc_(?:live|test)_[A-Za-z0-9_-]{8,}/.test(contactHandler)) {
  failures.push('contacto.php: committed VenderCRM key detected');
}
if (/re_[A-Za-z0-9]{20,}/.test(contactHandler)) {
  failures.push('contacto.php: committed Resend key detected');
}
if (!contactHtml.includes('https://crm.clientes.com.py/vc-attribution.js') || !contactHtml.includes('Enviar y continuar en WhatsApp')) {
  failures.push('contacto/index.html: CRM attribution or CRM-to-WhatsApp CTA missing');
}

const generatedConfigPath = join(root, 'config', 'site.generated.php');
try {
  const generatedConfig = await readFile(generatedConfigPath, 'utf8');
  if (!generatedConfig.includes(NUMBER)) failures.push('config/site.generated.php: configured number missing');
} catch {
  failures.push('config/site.generated.php: missing (run node build.mjs)');
}

// Any occurrence of the retired v1 number, outside docs/ (kept there for history).
for (const file of allFiles) {
  const relative = file.slice(root.length + 1);
  if (relative.startsWith('docs' + '\\') || relative.startsWith('docs/')) continue;
  if (!/\.(html|php|mjs|js)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  if (text.includes(OLD_NUMBER) || text.includes(OLD_NUMBER_SPACED)) {
    failures.push(`${relative}: retired v1 contact number found`);
  }
}

// Phase 2: WhatsApp launcher, header contact toggle and outbound link hygiene.
// The launcher carries exactly five direct wa.me options on every page; the
// sixth row is the ficha rápida form, which uses its own class on purpose.
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const relative = file.slice(root.length + 1);

  const waOptions = [...html.matchAll(/<a class="wa-option[^"]*" href="([^"]+)"/g)];
  if (waOptions.length !== 5) {
    failures.push(`${relative}: expected 5 wa-option links, found ${waOptions.length}`);
  }
  for (const [, href] of waOptions) {
    if (!href.startsWith(`https://wa.me/${NUMBER}?text=`)) {
      failures.push(`${relative}: wa-option href does not use the configured number`);
    }
    try {
      const text = decodeURIComponent(href.split('text=')[1] || '');
      if (!text.includes('Vi pozo.com.py')) failures.push(`${relative}: wa-option message is missing the page context line`);
    } catch {
      failures.push(`${relative}: wa-option href text does not decode`);
    }
  }

  if (!/class="contact-toggle"/.test(html)) failures.push(`${relative}: missing header contact-toggle`);
  if (!/<details class="wa-launcher" id="wa-launcher">/.test(html)) failures.push(`${relative}: missing no-JS WhatsApp launcher`);
  if (!/class="wa-ficha__form" action="\/contacto\.php" method="POST"/.test(html)) {
    failures.push(`${relative}: launcher ficha rápida form missing`);
  }

  for (const [tag] of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(tag)) failures.push(`${relative}: target="_blank" without rel="noopener": ${tag.slice(0, 90)}`);
  }

  for (const [, fontPath] of html.matchAll(/(?:href|src)="(\/assets\/fonts\/[^"?]+)/g)) {
    if (!allFiles.includes(join(root, fontPath.replace(/^\//, '').replace(/\//g, '\\')))) {
      failures.push(`${relative}: references a missing font file ${fontPath}`);
    }
  }
}

const cssSource = await readFile(join(root, 'assets', 'css', 'site.css'), 'utf8');
for (const [, fontPath] of cssSource.matchAll(/url\("(\/assets\/fonts\/[^"?]+)/g)) {
  if (!allFiles.includes(join(root, fontPath.replace(/^\//, '').replace(/\//g, '\\')))) {
    failures.push(`assets/css/site.css: references a missing font file ${fontPath}`);
  }
}

const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
if (!sitemap.includes('/servicios/') || /pozos-artesianos|desague-pozo-ciego/.test(sitemap)) {
  failures.push('sitemap.xml: short URL architecture is incomplete');
}

const routes = [
  '/', '/servicios/', '/servicios/artesiano/', '/servicios/precio-pozo/', '/servicios/pozo-ciego/',
  '/servicios/desague/', '/servicios/pozo-lleno/', '/servicios/septico/', '/servicios/agua/',
  '/zonas/san-lorenzo/', '/zonas/mra/', '/contacto/', '/privacidad/',
  '/gracias/',
];

for (const route of routes) {
  const response = await fetch(`${base}${route}`);
  if (!response.ok) failures.push(`${route}: HTTP ${response.status}`);
  const body = await response.text();
  if (!body.includes('<!doctype html>')) failures.push(`${route}: response is not HTML`);
}

const imageSizes = await Promise.all(allFiles.filter((file) => file.endsWith('.webp')).map(async (file) => ({ file, bytes: (await stat(file)).size })));
for (const image of imageSizes) {
  if (image.bytes > 450_000) failures.push(`${image.file.slice(root.length + 1)}: image exceeds 450 KB`);
}

if (failures.length) {
  console.error(`QA failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`QA passed: ${htmlFiles.length} HTML files, ${routes.length} HTTP routes, ${imageSizes.length} optimized images.`);
