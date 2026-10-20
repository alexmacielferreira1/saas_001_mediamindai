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

function textColors() {
  const fixedSlate = Object.fromEntries(
    FIXED_TEXT_SHADES.map((s) => [s, `rgb(${hexToRgbChannels(defaultColors.slate[s])} / <alpha-value>)`]),
  );
  const accents = Object.fromEntries(
    ACCENTS.map((name) => [
      name,
      Object.fromEntries(
        Object.keys(LIGHT_ACCENT_TEXT_SOURCE).map((s) => [s, rgbVar(`--mm-text-${name}-${s}`)]),
      ),
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
  }
  for (const [name, [darkHex, lightHex]] of Object.entries(SURFACES)) {
    dark[`--${name}`] = hexToRgbChannels(darkHex);
    light[`--${name}`] = hexToRgbChannels(lightHex);
  }
  return { dark, light };
}

function themePlugin({ addBase }) {
  const { dark, light } = themeVariables();
  addBase({ ':root, .dark': dark, '.light': light });
}

module.exports = {
  ACCENTS,
  LIGHT_NEUTRAL_SOURCE,
  SURFACES,
  hexToRgbChannels,
  slateColors,
  surfaceColors,
  textColors,
  themePlugin,
  themeVariables,
};
