(() => {
  'use strict';

  document.documentElement.classList.add('js');

  // --- First-touch attribution for the server-side lead handler ------------
  if (!document.cookie.split('; ').some((item) => item.startsWith('vc_attr='))) {
    const params = new URLSearchParams(window.location.search);
    const attribution = {
      landing_page: window.location.href.slice(0, 2000),
      referrer: document.referrer.slice(0, 2000),
    };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((key) => {
      const value = params.get(key);
      if (value) attribution[key] = value.slice(0, 200);
    });
    document.cookie = `vc_attr=${encodeURIComponent(JSON.stringify(attribution))}; Max-Age=7776000; Path=/; SameSite=Lax; Secure`;
  }

  // --- Header navigation ---------------------------------------------------
  const menuButton = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (menuButton && mainNav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      mainNav.classList.toggle('is-open', open);
    });

    mainNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        menuButton.setAttribute('aria-expanded', 'false');
        mainNav.classList.remove('is-open');
      }
    });
  }

  const submenuButton = document.querySelector('.submenu-toggle');
  const navServices = document.querySelector('.nav-services');
  if (submenuButton && navServices) {
    submenuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = submenuButton.getAttribute('aria-expanded') !== 'true';
      submenuButton.setAttribute('aria-expanded', String(open));
      navServices.classList.toggle('is-open', open);
    });

    document.addEventListener('click', (event) => {
      if (!navServices.contains(event.target)) {
        submenuButton.setAttribute('aria-expanded', 'false');
        navServices.classList.remove('is-open');
      }
    });
  }

  // --- Compact header after 24px of scroll ---------------------------------
  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    let ticking = false;
    const sync = () => {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    };
    sync();
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    }, { passive: true });
  }

  // --- WhatsApp launcher ---------------------------------------------------
  // The panel is a <details>, so it already works without JavaScript. JS adds
  // Escape, click-outside, focus handling and the header trigger.
  const launcher = document.querySelector('#wa-launcher');
  if (launcher) {
    const fab = launcher.querySelector('.wa-launcher__fab');
    const panel = launcher.querySelector('.wa-launcher__panel');
    const closeButton = launcher.querySelector('.wa-launcher__close');
    const mobileSheet = () => window.matchMedia('(max-width: 700px)').matches;
    let lastTrigger = null;

    if (closeButton) closeButton.hidden = false;

    // Upgrade the header link into a real button that toggles the same panel.
    const triggers = [];
    document.querySelectorAll('[data-launcher-trigger]').forEach((node) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = node.className;
      button.innerHTML = node.innerHTML;
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'wa-launcher');
      node.replaceWith(button);
      triggers.push(button);
      button.addEventListener('click', () => {
        lastTrigger = button;
        launcher.open = !launcher.open;
      });
    });

    const syncState = () => {
      const open = launcher.open;
      triggers.forEach((button) => button.setAttribute('aria-expanded', String(open)));
      if (fab) fab.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('launcher-open', open && mobileSheet());
    };

    launcher.addEventListener('toggle', () => {
      syncState();
      if (launcher.open) {
        const first = panel && panel.querySelector('.wa-option');
        if (first) first.focus({ preventScroll: true });
      } else if (lastTrigger && document.contains(lastTrigger)) {
        lastTrigger.focus({ preventScroll: true });
        lastTrigger = null;
      }
    });

    if (fab) {
      fab.addEventListener('click', () => { lastTrigger = fab; });
    }

    if (closeButton) {
      closeButton.addEventListener('click', () => { launcher.open = false; });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && launcher.open) {
        launcher.open = false;
        if (fab) fab.focus({ preventScroll: true });
      }
    });

    document.addEventListener('click', (event) => {
      if (!launcher.open) return;
      if (launcher.contains(event.target)) return;
      if (event.target.closest('[data-launcher-trigger], .contact-toggle')) return;
      launcher.open = false;
    });

    syncState();
  }

  // --- Reveal on scroll ----------------------------------------------------
  const revealables = document.querySelectorAll('.reveal');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (revealables.length && 'IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((node) => observer.observe(node));
  } else {
    revealables.forEach((node) => node.classList.add('is-in'));
  }

  // --- Calculator ----------------------------------------------------------
  const calculator = document.querySelector('#well-calculator');
  const estimate = document.querySelector('#estimate');
  const WA_NUMBER = (document.querySelector('.wa-option') || {}).href
    ? (document.querySelector('.wa-option').href.match(/wa\.me\/(\d+)/) || [])[1]
    : '';

  function selectedComponents(data) {
    return [
      ['Entubado', data.has('casing')],
      ['Filtro', data.has('filter')],
      ['Bomba', data.has('pump')],
      ['Tablero', data.has('panel')],
    ].filter(([, selected]) => selected).map(([label]) => label);
  }

  function calculatorSummary(data) {
    const depth = Math.max(10, Math.min(300, Number(data.get('depth')) || 60));
    const soil = data.get('soil');
    const components = selectedComponents(data);
    return { depth, soil, components };
  }

  function requestText() {
    const { depth, soil, components } = calculatorSummary(new FormData(calculator));
    return [
      'Hola, quiero cotizar un pozo artesiano.',
      'Ciudad/barrio: ___',
      `Profundidad estimada: ${depth} m`,
      `Tipo de suelo esperado: ${soil}`,
      `Componentes: ${components.join(', ') || 'solo perforación'}`,
      'Vi pozo.com.py – Precio por metro.',
    ].join('\n');
  }

  function renderEstimate({ depth, soil, components }) {
    const labels = {
      tierra: 'suelo de tierra',
      mixto: 'suelo mixto',
      roca: 'suelo de roca',
      desconocido: 'suelo por confirmar',
    };
    const rows = [
      `<li><span>Perforación</span><strong>${depth} m · a cotizar</strong></li>`,
      components.includes('Entubado') ? `<li><span>Entubado</span><strong>${depth} m · a cotizar</strong></li>` : '',
      components.includes('Filtro') ? '<li><span>Filtro</span><strong>A cotizar</strong></li>' : '',
      components.includes('Bomba') ? '<li><span>Bomba</span><strong>Según potencia</strong></li>' : '',
      components.includes('Tablero') ? '<li><span>Tablero</span><strong>Según configuración</strong></li>' : '',
    ].join('');

    const waHref = WA_NUMBER ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(requestText())}` : '';
    const waButton = waHref
      ? `<a class="button button--wa" id="send-estimate" href="${waHref}" target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>`
      : '';

    estimate.innerHTML = `<p class="eyebrow">Alcance inicial</p><h2>${depth} metros · ${labels[soil]}</h2><ul>${rows}</ul><div class="estimate-total"><span>Total</span><strong>A cotizar</strong></div><p>Enviá este alcance para confirmar suelo, profundidad, componentes y precio.</p><div class="estimate-actions"><button class="button button--outline" id="copy-estimate" type="button">Copiar solicitud</button>${waButton}</div>`;
  }

  async function copySummary() {
    const message = requestText();
    try {
      await navigator.clipboard.writeText(message);
      const activeButton = document.querySelector('#copy-estimate');
      if (activeButton) {
        activeButton.textContent = 'Solicitud copiada';
        setTimeout(() => { activeButton.textContent = 'Copiar solicitud'; }, 1800);
      }
    } catch {
      window.prompt('Copiá esta solicitud:', message);
    }
  }

  if (calculator && estimate) {
    calculator.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!calculator.reportValidity()) return;
      renderEstimate(calculatorSummary(new FormData(calculator)));
      estimate.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('#copy-estimate')) copySummary();
    });
  }

  // --- Forms ---------------------------------------------------------------
  document.querySelectorAll('input[name="page_url"]').forEach((field) => {
    field.value = window.location.href;
  });

  const status = document.querySelector('#form-status');
  const error = new URLSearchParams(window.location.search).get('error');
  if (error && status) {
    status.textContent = error === 'telefono'
      ? 'Revisá el número de teléfono e intentá nuevamente.'
      : 'Revisá los campos obligatorios e intentá nuevamente.';
  }

  // Keep the ficha message useful for the operator: name the chosen case.
  const fichaForm = document.querySelector('.wa-ficha__form');
  if (fichaForm) {
    const service = fichaForm.querySelector('select[name="service"]');
    const message = fichaForm.querySelector('input[name="message"]');
    const zona = fichaForm.querySelector('input[name="zona"]');
    fichaForm.addEventListener('submit', () => {
      if (!message) return;
      const parts = ['Ficha rápida enviada desde el sitio.'];
      if (service && service.value) parts.push(`Caso: ${service.value}.`);
      if (zona && zona.value) parts.push(`Ciudad/barrio: ${zona.value}.`);
      parts.push('Pido que me escriban por WhatsApp.');
      message.value = parts.join(' ');
    });
  }
})();
