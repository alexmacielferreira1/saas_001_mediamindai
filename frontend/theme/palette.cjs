// Paleta temática do MediaMind.
// O tema escuro usa exatamente os valores padrão do Tailwind (nenhuma mudança visual);
// o tema claro inverte a escala neutra e escurece os tons claros de texto de destaque.
const defaultColors = require('tailwindcss/colors');

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// Escala neutra invertida: fundos escuros viram claros e textos claros viram escuros.
const LIGHT_NEUTRAL_SOURCE = {
  50: '950',
  100: '900',
  200: '800',
  300: '700',
  400: '600',
  500: '500',
  600: '400',
  700: '300',
  800: '200',
  900: '100',
  950: '50',
};

// Textos sobre botões e selos claros: mantêm o tom escuro nos dois temas.
const FIXED_TEXT_SHADES = ['900', '950'];

// Tons de texto de destaque legíveis no escuro que perdem contraste no fundo claro.
const ACCENTS = [
  'sky', 'cyan', 'emerald', 'amber', 'rose', 'red', 'violet', 'indigo', 'blue',
  'green', 'yellow', 'orange', 'purple', 'pink', 'teal', 'fuchsia', 'lime',
];
const LIGHT_ACCENT_TEXT_SOURCE = { 100: '800', 200: '700', 300: '700', 400: '600' };
// Fundos/bordas tingidos escuros (ex.: bg-sky-950/30) viram tintas claras no tema claro.
const LIGHT_ACCENT_SURFACE_SOURCE = { 800: '200', 900: '100', 950: '50' };

// Superfícies azul-marinho da marca, antes fixadas em hex nas páginas: [escuro, claro].
const SURFACES = {
  'mm-page': ['#020817', defaultColors.slate[50]],
  'mm-drawer': ['#041326', '#ffffff'],
  'mm-studio': ['#07111f', defaultColors.slate[100]],
  'mm-bar': ['#081421', '#ffffff'],
};

function hexToRgbChannels(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Cor inválida: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

const rgbVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

function slateColors() {
  return Object.fromEntries(SHADES.map((s) => [s, rgbVar(`--mm-slate-${s}`)]));
}

function surfaceColors() {
  return Object.fromEntries(Object.keys(SURFACES).map((name) => [name, rgbVar(`--${name}`)]));
}

function accentSurfaceColors() {
  return Object.fromEntries(
    ACCENTS.map((name) => [
      name,
      Object.fromEntries(
        Object.keys(LIGHT_ACCENT_SURFACE_SOURCE).map((s) => [s, rgbVar(`--mm-${name}-${s}`)]),
      ),
    ]),
  );
}

const fixedRgb = (hex) => `rgb(${hexToRgbChannels(hex)} / <alpha-value>)`;

function textColors() {
  const fixedSlate = Object.fromEntries(
    FIXED_TEXT_SHADES.map((s) => [s, fixedRgb(defaultColors.slate[s])]),
  );
  const accents = Object.fromEntries(
    ACCENTS.map((name) => [
      name,
      {
        ...Object.fromEntries(
          Object.keys(LIGHT_ACCENT_TEXT_SOURCE).map((s) => [s, rgbVar(`--mm-text-${name}-${s}`)]),
        ),
        // Texto escuro sobre selos claros: fixo nos dois temas.
        ...Object.fromEntries(
          Object.keys(LIGHT_ACCENT_SURFACE_SOURCE).map((s) => [s, fixedRgb(defaultColors[name][s])]),
        ),
      },
    ]),
  );
  return { slate: fixedSlate, ...accents };
}

function themeVariables() {
  const dark = {};
  const light = {};
  for (const s of SHADES) {
    dark[`--mm-slate-${s}`] = hexToRgbChannels(defaultColors.slate[s]);
    light[`--mm-slate-${s}`] = hexToRgbChannels(defaultColors.slate[LIGHT_NEUTRAL_SOURCE[s]]);
  }
  for (const name of ACCENTS) {
    for (const [s, lightSource] of Object.entries(LIGHT_ACCENT_TEXT_SOURCE)) {
      dark[`--mm-text-${name}-${s}`] = hexToRgbChannels(defaultColors[name][s]);
      light[`--mm-text-${name}-${s}`] = hexToRgbChannels(defaultColors[name][lightSource]);
    }
    for (const [s, lightSource] of Object.entries(LIGHT_ACCENT_SURFACE_SOURCE)) {
      dark[`--mm-${name}-${s}`] = hexToRgbChannels(defaultColors[name][s]);
      light[`--mm-${name}-${s}`] = hexToRgbChannels(defaultColors[name][lightSource]);
    }
  }
  for (const [name, [darkHex, lightHex]] of Object.entries(SURFACES)) {
    dark[`--${name}`] = hexToRgbChannels(darkHex);
    light[`--${name}`] = hexToRgbChannels(lightHex);
  }
  return { dark, light };
}

// --- Cinzas fixos em hex (editores estilo NLE) -------------------------------------------
// Classes como bg-[#202020] continuam iguais no escuro; no claro recebem uma versão com a
// luminosidade invertida. Só fundos/bordas escuros e textos claros são invertidos, para não
// afetar superfícies que já são claras (ex.: documentos do Office) nem cores de destaque.

const GRAY_CLASS = /(?<![\w-])((?:hover:|focus:)?)(bg|border|text|divide)-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\](?:\/(\d{1,3}))?(?![\w-])/g;
const MAX_GRAY_CHROMA = 24;

function rgbOf(hex) {
  return hexToRgbChannels(hex).split(' ').map(Number);
}

function lightGrayFor(hex, kind) {
  const [r, g, b] = rgbOf(hex);
  if (Math.max(r, g, b) - Math.min(r, g, b) > MAX_GRAY_CHROMA) return null;
  const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
  let target;
  if (kind === 'text') {
    if (lightness <= 0.5) return null;
    target = Math.min(1 - lightness, 0.45);
  } else {
    if (lightness >= 0.45) return null;
    target = 1 - lightness * 0.6;
  }
  // Leve tom azulado da escala slate, para combinar com o restante do tema claro.
  const v = Math.round(target * 255);
  return [Math.max(0, v - 6), Math.max(0, v - 3), Math.min(255, v + 3)].join(' ');
}

function escapeClass(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

const PROPERTY = {
  bg: (color) => ({ 'background-color': color }),
  border: (color) => ({ 'border-color': color }),
  text: (color) => ({ color }),
};

function grayOverrideRules(sources) {
  const rules = {};
  for (const source of sources) {
    for (const match of source.matchAll(GRAY_CLASS)) {
      const [className, variant, kind, hex, alpha] = match;
      const channels = lightGrayFor(hex, kind === 'divide' ? 'border' : kind);
      if (!channels) continue;
      const color = alpha ? `rgb(${channels} / ${Number(alpha) / 100})` : `rgb(${channels})`;
      const pseudo = variant ? `:${variant.slice(0, -1)}` : '';
      const selector = `.light .${escapeClass(className)}${pseudo}`;
      if (kind === 'divide') {
        rules[`${selector} > :not([hidden]) ~ :not([hidden])`] = { 'border-color': color };
      } else {
        rules[selector] = PROPERTY[kind](color);
      }
    }
  }
  return rules;
}

function readSources(dir) {
  const fs = require('node:fs');
  const path = require('node:path');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((file) => /\.(jsx?|tsx?)$/.test(file) && !/\.test\./.test(file))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'));
}

function createThemePlugin(sourceDir) {
  return function themePlugin({ addBase }) {
    const { dark, light } = themeVariables();
    addBase({ ':root, .dark': dark, '.light': light });
    addBase(grayOverrideRules(readSources(sourceDir)));
  };
}

const themePlugin = createThemePlugin(require('node:path').join(__dirname, '..', 'src'));

module.exports = {
  ACCENTS,
  LIGHT_NEUTRAL_SOURCE,
  SURFACES,
  accentSurfaceColors,
  createThemePlugin,
  grayOverrideRules,
  hexToRgbChannels,
  lightGrayFor,
  slateColors,
  surfaceColors,
  textColors,
  themePlugin,
  themeVariables,
};
