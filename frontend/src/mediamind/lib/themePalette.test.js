import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const defaultColors = require('tailwindcss/colors');
const palette = require('../../../theme/palette.cjs');

const channels = palette.hexToRgbChannels;

describe('paleta temática', () => {
  const { dark, light } = palette.themeVariables();

  it('mantém o tema escuro idêntico à paleta slate original do Tailwind', () => {
    for (const [shade, hex] of Object.entries(defaultColors.slate)) {
      expect(dark[`--mm-slate-${shade}`]).toBe(channels(hex));
    }
  });

  it('mantém os textos de destaque do escuro com os tons originais', () => {
    for (const name of palette.ACCENTS) {
      for (const shade of ['100', '200', '300', '400']) {
        expect(dark[`--mm-text-${name}-${shade}`]).toBe(channels(defaultColors[name][shade]));
      }
    }
  });

  it('mantém as superfícies marinho do escuro com os hex que existiam nas páginas', () => {
    expect(dark['--mm-page']).toBe(channels('#020817'));
    expect(dark['--mm-drawer']).toBe(channels('#041326'));
    expect(dark['--mm-studio']).toBe(channels('#07111f'));
    expect(dark['--mm-bar']).toBe(channels('#081421'));
  });

  it('inverte a escala neutra no tema claro', () => {
    expect(light['--mm-slate-950']).toBe(channels(defaultColors.slate[50]));
    expect(light['--mm-slate-800']).toBe(channels(defaultColors.slate[200]));
    expect(light['--mm-slate-500']).toBe(channels(defaultColors.slate[500]));
    expect(light['--mm-slate-100']).toBe(channels(defaultColors.slate[900]));
    expect(Object.keys(light)).toEqual(Object.keys(dark));
  });

  it('escurece os textos de destaque claros no tema claro', () => {
    expect(light['--mm-text-sky-300']).toBe(channels(defaultColors.sky[700]));
    expect(light['--mm-text-emerald-400']).toBe(channels(defaultColors.emerald[600]));
  });

  it('mantém texto slate-900/950 fixo para botões claros nos dois temas', () => {
    const text = palette.textColors();
    expect(text.slate['950']).toBe(`rgb(${channels(defaultColors.slate[950])} / <alpha-value>)`);
    expect(text.slate['900']).toBe(`rgb(${channels(defaultColors.slate[900])} / <alpha-value>)`);
    expect(text.sky['300']).toBe('rgb(var(--mm-text-sky-300) / <alpha-value>)');
  });

  it('expõe slate e superfícies como variáveis com suporte a opacidade', () => {
    expect(palette.slateColors()['800']).toBe('rgb(var(--mm-slate-800) / <alpha-value>)');
    expect(palette.surfaceColors()['mm-drawer']).toBe('rgb(var(--mm-drawer) / <alpha-value>)');
  });

  it('registra as variáveis para :root/.dark e .light no plugin', () => {
    const calls = [];
    palette.themePlugin({ addBase: (rules) => calls.push(rules) });
    expect(Object.keys(calls[0])).toEqual([':root, .dark', '.light']);
  });

  it('converte hex curto e recusa cor inválida', () => {
    expect(channels('#fff')).toBe('255 255 255');
    expect(() => channels('#zzzzzz')).toThrow('Cor inválida');
  });
});
