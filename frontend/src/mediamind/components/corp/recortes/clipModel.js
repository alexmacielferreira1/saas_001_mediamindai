import { MOCK_CORP_RECORTES } from '../../../data';

let counter = 100;
export const SAMPLE_VIDEO = '';

export function fmt(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export const STAGES = [
  { id: 'selecao', name: 'Seleção', desc: 'Defina o trecho (IN/OUT) do corte geral que a IA vai processar.' },
  { id: 'ia', name: 'Análise IA', desc: 'Processe o trecho e escolha os trechos mais viralizáveis por nota.' },
  { id: 'legendas', name: 'Legendas', desc: 'Gere, edite e corte as legendas (cortando o áudio ou não).' },
  { id: 'cg', name: 'CGs', desc: 'Edite lower-thirds e grafismos. Salve pra editar externamente.' },
  { id: 'reimport', name: 'Reimportar', desc: 'Volte com o vídeo editado externamente e continue a esteira.' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.name]));

export function newClip({ titulo, source_url } = {}) {
  counter += 1;
  return {
    id: `clip-${counter}`,
    titulo: titulo || 'Novo recorte',
    source_url: source_url || SAMPLE_VIDEO,
    duration_ms: 0,
    stage: 'selecao',
    in_ms: 0,
    out_ms: 0,
    viral: [],
    legendas: [],
    cortes_audio: [],
    cgs: [],
    salvo: false,
    edited_url: '',
    pronto: false,
  };
}

export function seedClips() {
  return (MOCK_CORP_RECORTES || []).slice(0, 3).map((r, i) => ({
    ...newClip({ titulo: r.titulo }),
    id: `clip-${i + 1}`,
    stage: i === 0 ? 'legendas' : 'selecao',
    in_ms: 5000,
    out_ms: 120000,
  }));
}

// Simulação da IA: divide o trecho IN/OUT em candidatos e atribui notas de viralidade.
export function gerarVirais(clip) {
  const start = clip.in_ms || 0;
  const end = clip.out_ms || clip.duration_ms || 60000;
  const span = Math.max(20000, end - start);
  const n = 5;
  const out = [];
  const titulos = ['Gancho de abertura', 'Pico de emoção', 'Revelação', 'Frase de impacto', 'Conclusão polêmica', 'Momento engraçado'];
  for (let i = 0; i < n; i++) {
    const segLen = 8000 + Math.floor(Math.random() * 12000);
    const s = Math.max(start, start + Math.floor((span / n) * i) + Math.floor(Math.random() * 4000));
    out.push({
      id: `v-${Date.now()}-${i}`,
      start_ms: s,
      end_ms: s + segLen,
      score: 50 + Math.floor(Math.random() * 49),
      titulo: titulos[i % titulos.length],
      selected: i < 3,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function gerarLegendas(clip) {
  const virais = (clip.viral || []).filter((v) => v.selected);
  const base = virais.length ? virais : [{ start_ms: clip.in_ms, end_ms: clip.out_ms }];
  const out = [];
  let k = 0;
  for (const v of base) {
    out.push({
      id: `l-${Date.now()}-${k++}`,
      start_ms: Math.round(v.start_ms),
      end_ms: Math.round(v.end_ms),
      texto: v.texto || v.summary || v.titulo || '',
      cortar_audio: false,
    });
  }
  return out;
}
