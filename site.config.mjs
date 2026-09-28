export const SITE = {
  name: 'Pozo.com.py',
  url: 'https://pozo.com.py',
  tagline: 'Pozos artesianos y desagüe de pozos ciegos en Paraguay',
  city: 'Asunción',
  region: 'Capital',
  country: 'PY',
  languages: ['es-PY', 'gn'],
  hoursText: 'Lun a Sáb 07:00–19:00 · Urgencias de desagüe, también domingo',
  whatsapp: '595992279599',
  phoneDisplay: '+595 992 279 599',
  phoneHref: '+595992279599',
  leadEmail: '',
  venderCrmUrl: 'https://crm.clientes.com.py',
  capacity: '8 m³',
  assetVersion: '20260902-1',
};

export const DEMO_MODE = false;

export const PRICES = {
  drillingSoilPerMeter: null,
  drillingMixedPerMeter: null,
  drillingRockPerMeter: null,
  casingPerMeter: null,
  filter: null,
  pump: null,
  controlPanel: null,
  drainageTrip8m3: null,
};

// Each option: id, label, hint, urgent (boolean), message(ctx) -> string.
// ctx = { pageLabel, zone } where pageLabel is the current page's short label
// and zone is the city/zone name on zone pages (empty elsewhere).
export const LAUNCHER_OPTIONS = [
  {
    id: 'urgente',
    label: 'Desagüe urgente / pozo rebalsado',
    hint: 'Camión atmosférico, hoy si hay disponibilidad',
    urgent: true,
    message: (ctx) => [
      'Hola, necesito un desagüe urgente. Mi pozo ciego está lleno o rebalsando.',
      `Ciudad/barrio: ${ctx.zone || '___'}`,
      '¿Puede entrar un camión hasta el pozo?: ___',
      `Vi pozo.com.py – ${ctx.pageLabel}.`,
    ].join('\n'),
  },
  {
    id: 'artesiano',
    label: 'Cotizar pozo artesiano',
    hint: 'Perforación, entubado, bomba y tablero',
    urgent: false,
    message: (ctx) => [
      'Hola, quiero cotizar un pozo artesiano.',
      `Ciudad/barrio: ${ctx.zone || '___'}`,
      'Uso del agua (casa, comercio, riego, obra): ___',
      'Profundidad estimada, si la conozco: ___',
      `Vi pozo.com.py – ${ctx.pageLabel}.`,
    ].join('\n'),
  },
  {
    id: 'ciego',
    label: 'Consulta por pozo ciego o séptico',
    hint: 'Construcción, mantenimiento, biodigestor',
    urgent: false,
    message: (ctx) => [
      'Hola, tengo una consulta por pozo ciego o sistema séptico.',
      `Ciudad/barrio: ${ctx.zone || '___'}`,
      'Qué pasa o qué necesito: ___',
      `Vi pozo.com.py – ${ctx.pageLabel}.`,
    ].join('\n'),
  },
  {
    id: 'agua',
    label: 'Tratamiento / análisis de agua',
    hint: 'Sarro, hierro, color, cloración',
    urgent: false,
    message: (ctx) => [
      'Hola, quiero consultar por tratamiento o análisis de agua de pozo.',
      `Ciudad/barrio: ${ctx.zone || '___'}`,
      'Problema (sarro, hierro, color, olor): ___',
      '¿Tengo análisis?: ___',
      `Vi pozo.com.py – ${ctx.pageLabel}.`,
    ].join('\n'),
  },
  {
    id: 'otro',
    label: 'Hablar sobre otro caso',
    hint: 'Contanos qué pasa y dónde',
    urgent: false,
    message: (ctx) => [
      'Hola, quiero hablar sobre otro caso.',
      `Ciudad/barrio: ${ctx.zone || '___'}`,
      'Qué necesito: ___',
      `Vi pozo.com.py – ${ctx.pageLabel}.`,
    ].join('\n'),
  },
];

// form_id -> VenderCRM source. Unknown form_id falls back to 'contacto'.
export const CONTACT_SOURCES = {
  contacto: 'site:pozo.com.py:contacto',
  ficha: 'site:pozo.com.py:ficha-rapida',
};
