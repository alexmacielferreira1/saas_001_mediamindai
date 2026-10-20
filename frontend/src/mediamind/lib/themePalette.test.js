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

  it('inverte cinzas escuros de fundo e claros de texto, preservando o restante', () => {
    expect(palette.lightGrayFor('#202020', 'bg')).toBe('230 233 239');
    expect(palette.lightGrayFor('#bcbcbc', 'text')).toBe('61 64 70');
    expect(palette.lightGrayFor('#555', 'text')).toBeNull();
    expect(palette.lightGrayFor('#e8e8e8', 'bg')).toBeNull();
    expect(palette.lightGrayFor('#2675df', 'bg')).toBeNull();
  });

  it('gera sobreposições só para o tema claro, com variantes e opacidade', () => {
    const rules = palette.grayOverrideRules([
      'className="bg-[#202020] hover:bg-[#242424] border-[#555]/50 text-[#bcbcbc] divide-[#333]"',
      'className="bg-[#e8e8e8] text-[#242424] bg-[#a9343c] xbg-[#111]"',
    ]);
    expect(rules['.light .bg-\\[\\#202020\\]']).toEqual({ 'background-color': 'rgb(230 233 239)' });
    expect(rules['.light .hover\\:bg-\\[\\#242424\\]:hover']).toBeDefined();
    expect(rules['.light .border-\\[\\#555\\]\\/50']['border-color']).toMatch(/\/ 0\.5\)$/);
    expect(rules['.light .text-\\[\\#bcbcbc\\]']).toEqual({ color: 'rgb(61 64 70)' });
    expect(rules['.light .divide-\\[\\#333\\] > :not([hidden]) ~ :not([hidden])']).toBeDefined();
    expect(Object.keys(rules).every((selector) => selector.startsWith('.light '))).toBe(true);
    expect(Object.keys(rules)).toHaveLength(5);
  });

  it('o plugin padrão lê os fontes reais e cobre os cinzas dos editores', () => {
    const calls = [];
    palette.themePlugin({ addBase: (rules) => calls.push(rules) });
    expect(calls[1]['.light .bg-\\[\\#202020\\]']).toBeDefined();
  });

  it('o plugin tolera pasta de fontes ausente', () => {
    const calls = [];
    palette.createThemePlugin('pasta-inexistente')({ addBase: (rules) => calls.push(rules) });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({});
  });

  it('clareia fundos tingidos de destaque no claro e mantém o escuro original', () => {
    expect(dark['--mm-sky-950']).toBe(channels(defaultColors.sky[950]));
    expect(light['--mm-sky-950']).toBe(channels(defaultColors.sky[50]));
    expect(light['--mm-rose-800']).toBe(channels(defaultColors.rose[200]));
    expect(palette.accentSurfaceColors().sky['900']).toBe('rgb(var(--mm-sky-900) / <alpha-value>)');
    expect(palette.textColors().emerald['950']).toBe(
      `rgb(${channels(defaultColors.emerald[950])} / <alpha-value>)`,
    );
  });

  it('converte hex curto e recusa cor inválida', () => {
    expect(channels('#fff')).toBe('255 255 255');
    expect(() => channels('#zzzzzz')).toThrow('Cor inválida');
  });
});
