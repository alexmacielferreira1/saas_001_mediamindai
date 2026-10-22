// Catálogo de ferramentas de um clique do MMLight para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { sourceId, sourceName, photos, albums, baseAdjust, image, pickedIds, newId } e devolve
// { ok, summary, photos, albums } — o app grava `photos`/`albums` (o MCP guarda o estado anterior para desfazer).
// Tudo usa o mesmo pipeline de revelação do editor (ajustes, perfil, máscaras linear/radial, catálogo).
import {
  CircleDot,
  CopyCheck,
  Eraser,
  Flag,
  FolderPlus,
  Palette,
  RotateCcw,
  ScanFace,
  Sparkles,
  Star,
  Sun,
  SunDim,
  Sunset,
  SwatchBook,
  WandSparkles,
} from "lucide-react";
import { DEFAULT_ADJUST, autoAdjust, isNeutral } from "./lightcraftPipeline";

export const LIGHT_FOLDERS = ["2026", "Fronteiras da Saúde", "Eventos", "Institucional"];
export const LIGHT_COLLECTIONS = ["Selecionadas", "Publicação", "Retratos", "SIMERS"];
export const LIGHT_COLOR_LABELS = ["", "Vermelho", "Amarelo", "Verde", "Azul", "Roxo"];
export const LIGHT_PROFILES = ["Adobe Color", "Camera Standard", "Monocromático"];

export const MMLIGHT_TABS = [
  { id: "tom", label: "Tom" },
  { id: "cor", label: "Cor e perfil" },
  { id: "mascaras", label: "Máscaras" },
  { id: "catalogo", label: "Catálogo" },
];

class ToolError extends Error {}

const signed = (value) => `${value > 0 ? "+" : ""}${value}`;

function current(state) {
  if (!state.sourceId) throw new ToolError("Importe ou selecione uma fotografia primeiro.");
  return state.photos[state.sourceId] || {};
}

const adjustOf = (state, meta) => ({ ...(meta.adjust || state.baseAdjust) });

function withPhoto(state, change) {
  return { ...state.photos, [state.sourceId]: { ...(state.photos[state.sourceId] || {}), ...change } };
}

function done(state, summary, photos, albums = state.albums, count = 1) {
  return { ok: true, count, summary, photos, albums };
}

function setAdjust(keys, label) {
  return (state, params) => {
    const meta = current(state);
    const values = Object.fromEntries(keys.map(([key, param]) => [key, params[param]]));
    const text = keys.map(([key, param]) => `${key} ${signed(params[param])}`).join(", ");
    return done(state, `${label} em ${state.sourceName}: ${text}`, withPhoto(state, { adjust: { ...adjustOf(state, meta), ...values } }));
  };
}

function auto(state) {
  current(state);
  if (!state.image) throw new ToolError("Aguarde a foto carregar para o ajuste automático.");
  const adjust = autoAdjust(state.image);
  return done(state, `Ajuste automático em ${state.sourceName}: exposição ${signed(adjust.exposição)}, contraste ${signed(adjust.contraste)}`, withPhoto(state, { adjust }));
}

function reset(state, params) {
  const meta = current(state);
  const masks = meta.masks || [];
  const profile = meta.profile || "Adobe Color";
  if (isNeutral(adjustOf(state, meta), [], profile) && (!params.masks || !masks.length)) {
    throw new ToolError("A foto já está sem ajustes para redefinir.");
  }
  return done(
    state,
    `Ajustes de ${state.sourceName} redefinidos${params.masks ? " (máscaras removidas)" : ""}`,
    withPhoto(state, { adjust: { ...DEFAULT_ADJUST }, profile: "Adobe Color", ...(params.masks ? { masks: [] } : {}) }),
  );
}

function profile(state, params) {
  const meta = current(state);
  if ((meta.profile || "Adobe Color") === params.profile) throw new ToolError(`A foto já usa o perfil ${params.profile}.`);
  return done(state, `Perfil de ${state.sourceName}: ${params.profile}`, withPhoto(state, { profile: params.profile }));
}

const LOOKS = {
  vivid: { label: "Vívido", profile: "Camera Standard", adjust: { contraste: 15, claridade: 10, saturação: 30 } },
  soft: { label: "Suave", profile: "Adobe Color", adjust: { contraste: -15, realces: -20, sombras: 20, claridade: -10, saturação: -10 } },
  drama: { label: "Dramático", profile: "Adobe Color", adjust: { contraste: 35, realces: -40, sombras: 30, pretos: -20, textura: 20, claridade: 40 } },
  bw: { label: "P&B contrastado", profile: "Monocromático", adjust: { contraste: 30, brancos: 10, pretos: -15, claridade: 20 } },
};

function look(state, params) {
  current(state);
  const preset = LOOKS[params.look];
  return done(
    state,
    `Look ${preset.label} aplicado em ${state.sourceName} (perfil ${preset.profile})`,
    withPhoto(state, { adjust: { ...DEFAULT_ADJUST, ...preset.adjust }, profile: preset.profile }),
  );
}

function putMask(state, type, geometry, adjust, label) {
  const meta = current(state);
  const masks = meta.masks || [];
  const existing = masks.find((mask) => mask.type === type);
  const mask = { ...(existing || { id: state.newId(type) }), type, ...geometry, adjust: { ...DEFAULT_ADJUST, ...adjust } };
  const next = existing ? masks.map((item) => (item === existing ? mask : item)) : [...masks, mask];
  return done(state, `${label} ${existing ? "atualizado" : "criado"} em ${state.sourceName}`, withPhoto(state, { masks: next }));
}

function radial(state, params) {
  const size = params.size / 100;
  return putMask(
    state,
    "radial",
    { cx: params.cx / 100, cy: params.cy / 100, rx: size, ry: Math.round(size * 1.2 * 100) / 100 },
    { exposição: params.exposure, claridade: params.clarity },
    "Realce radial",
  );
}

function linear(state, params) {
  if (params.end <= params.start) throw new ToolError("O fim do gradiente precisa ficar abaixo do início.");
  return putMask(state, "linear", { start: params.start / 100, end: params.end / 100 }, { exposição: params.exposure, realces: params.highlights }, "Gradiente linear");
}

function clearMasks(state) {
  const masks = current(state).masks || [];
  if (!masks.length) throw new ToolError("Esta foto não tem máscaras.");
  return done(state, `${masks.length} máscara(s) removida(s) de ${state.sourceName}`, withPhoto(state, { masks: [] }), state.albums, masks.length);
}

function targets(state, scope) {
  current(state);
  if (scope === "current") return [state.sourceId];
  const others = state.pickedIds.filter((id) => id !== state.sourceId);
  if (!others.length) throw new ToolError("Selecione outras fotos na tira (Ctrl+clique ou Shift+clique) primeiro.");
  return [state.sourceId, ...others];
}

function patchMany(state, ids, change) {
  const photos = { ...state.photos };
  ids.forEach((id) => {
    photos[id] = { ...(photos[id] || {}), ...change };
  });
  return photos;
}

function rate(state, params) {
  const ids = targets(state, params.scope);
  return done(state, `${ids.length} foto(s) com ${params.stars} estrela(s)`, patchMany(state, ids, { rating: params.stars }), state.albums, ids.length);
}

function mark(state, params) {
  if (params.flag === "keep" && params.color === "keep") throw new ToolError("Escolha uma bandeira ou um rótulo de cor para aplicar.");
  const ids = targets(state, params.scope);
  const change = {
    ...(params.flag === "keep" ? {} : { flag: params.flag === "on" }),
    ...(params.color === "keep" ? {} : { color: params.color }),
  };
  const parts = [
    params.flag === "keep" ? null : params.flag === "on" ? "sinalizada(s)" : "sem bandeira",
    params.color === "keep" ? null : params.color ? `rótulo ${params.color}` : "sem rótulo de cor",
  ].filter(Boolean);
  return done(state, `${ids.length} foto(s): ${parts.join(", ")}`, patchMany(state, ids, change), state.albums, ids.length);
}

function collect(state, params) {
  const ids = targets(state, params.scope);
  const before = state.albums[params.entry] || [];
  const added = ids.filter((id) => !before.includes(id));
  if (!added.length) throw new ToolError(`Já está(ão) em "${params.entry}".`);
  return done(state, `${added.length} foto(s) adicionada(s) a "${params.entry}"`, state.photos, { ...state.albums, [params.entry]: [...before, ...added] }, added.length);
}

function sync(state) {
  const meta = current(state);
  const others = state.pickedIds.filter((id) => id !== state.sourceId);
  if (!others.length) throw new ToolError("Selecione outras fotos na tira (Ctrl+clique ou Shift+clique) para sincronizar.");
  const adjust = adjustOf(state, meta);
  const masks = meta.masks || [];
  const photos = { ...state.photos };
  others.forEach((id) => {
    photos[id] = {
      ...(photos[id] || {}),
      adjust: { ...adjust },
      profile: meta.profile || "Adobe Color",
      masks: masks.map((mask) => ({ ...mask, adjust: { ...mask.adjust } })),
    };
  });
  return done(state, `Ajustes de ${state.sourceName} sincronizados com ${others.length} foto(s)`, photos, state.albums, others.length);
}

const range = (key, label, min, max, value, unit) => ({ key, label, type: "range", min, max, step: 1, default: value, ...(unit ? { unit } : {}) });
const scope = {
  key: "scope",
  label: "Aplicar em",
  type: "select",
  default: "current",
  options: [
    ["current", "Foto atual"],
    ["picked", "Foto atual + selecionadas na tira"],
  ],
};
const ONE_PHOTO = "Altera só a foto aberta (os ajustes ficam guardados por foto, sem mexer no arquivo original).";

export function mmlightCatalogue() {
  const entries = [...LIGHT_FOLDERS.map((item) => [item, `Pasta ${item}`]), ...LIGHT_COLLECTIONS.map((item) => [item, `Coleção ${item}`])];
  const tools = [
    { id: "tone.auto", tab: "tom", label: "Automático", icon: WandSparkles, description: "Calcula exposição, contraste, realces, sombras, brancos e pretos pela luminância da foto.", how: ONE_PHOTO, params: [], run: auto },
    {
      id: "tone.light",
      tab: "tom",
      label: "Luz",
      icon: Sun,
      description: "Define exposição e contraste da foto.",
      how: ONE_PHOTO,
      params: [range("exposure", "Exposição", -100, 100, 20), range("contrast", "Contraste", -100, 100, 10)],
      run: setAdjust([["exposição", "exposure"], ["contraste", "contrast"]], "Luz"),
    },
    {
      id: "tone.recover",
      tab: "tom",
      label: "Recuperar",
      icon: SunDim,
      description: "Recupera céu estourado e sombras fechadas (realces, sombras, brancos e pretos).",
      how: ONE_PHOTO,
      params: [range("highlights", "Realces", -100, 100, -40), range("shadows", "Sombras", -100, 100, 40), range("whites", "Brancos", -100, 100, 10), range("blacks", "Pretos", -100, 100, -10)],
      run: setAdjust([["realces", "highlights"], ["sombras", "shadows"], ["brancos", "whites"], ["pretos", "blacks"]], "Tons recuperados"),
    },
    {
      id: "tone.presence",
      tab: "tom",
      label: "Presença",
      icon: Sparkles,
      description: "Textura, claridade (contraste local) e saturação.",
      how: ONE_PHOTO,
      params: [range("texture", "Textura", -100, 100, 15), range("clarity", "Claridade", -100, 100, 20), range("saturation", "Saturação", -100, 100, 10)],
      run: setAdjust([["textura", "texture"], ["claridade", "clarity"], ["saturação", "saturation"]], "Presença"),
    },
    {
      id: "tone.reset",
      tab: "tom",
      label: "Redefinir",
      icon: RotateCcw,
      description: "Zera todos os ajustes e volta ao perfil Adobe Color.",
      params: [{ key: "masks", label: "Remover também as máscaras", type: "toggle", default: false }],
      run: reset,
    },
    {
      id: "color.profile",
      tab: "cor",
      label: "Perfil",
      icon: Palette,
      description: "Troca o perfil de cor da revelação (Monocromático gera preto e branco).",
      params: [{ key: "profile", label: "Perfil", type: "select", default: "Camera Standard", options: LIGHT_PROFILES.map((item) => [item, item]) }],
      run: profile,
    },
    {
      id: "color.look",
      tab: "cor",
      label: "Looks",
      icon: SwatchBook,
      description: "Aplica um conjunto pronto de ajustes e perfil (substitui os ajustes globais; máscaras ficam).",
      params: [{ key: "look", label: "Look", type: "chips", default: "vivid", options: Object.entries(LOOKS).map(([id, item]) => [id, item.label]) }],
      run: look,
    },
    {
      id: "mask.radial",
      tab: "mascaras",
      label: "Realce radial",
      icon: CircleDot,
      description: "Clareia e dá definição a uma área oval (rosto, produto). Se já houver máscara radial, ela é atualizada.",
      how: "Centro e tamanho em % da foto. Para ajustar à mão depois, clique em Radial no painel de máscaras.",
      params: [
        range("cx", "Centro horizontal", 0, 100, 50, "%"),
        range("cy", "Centro vertical", 0, 100, 50, "%"),
        range("size", "Tamanho", 10, 80, 35, "%"),
        range("exposure", "Exposição na área", -100, 100, 25),
        range("clarity", "Claridade na área", -100, 100, 15),
      ],
      run: radial,
    },
    {
      id: "mask.linear",
      tab: "mascaras",
      label: "Gradiente céu",
      icon: Sunset,
      description: "Gradiente linear de cima para baixo para escurecer céu e recuperar realces. Se já houver máscara linear, ela é atualizada.",
      params: [
        range("start", "Efeito total até", 0, 90, 10, "%"),
        range("end", "Desaparece em", 5, 100, 55, "%"),
        range("exposure", "Exposição no topo", -100, 100, -30),
        range("highlights", "Realces no topo", -100, 100, -20),
      ],
      run: linear,
    },
    { id: "mask.clear", tab: "mascaras", label: "Limpar máscaras", icon: Eraser, description: "Remove todas as máscaras locais da foto (linear, radial e pincel).", params: [], run: clearMasks },
    {
      id: "mask.ai",
      tab: "mascaras",
      label: "Assunto / Céu / Pessoas",
      icon: ScanFace,
      status: "soon",
      soonReason: "máscaras de Assunto, Céu e Pessoas precisam de segmentação por IA, que ainda não roda no navegador. Use Gradiente céu ou Realce radial.",
      description: "Seleciona automaticamente o assunto, o céu ou as pessoas da foto.",
      params: [],
      run: () => ({ ok: false, summary: "Máscaras por IA ainda não estão disponíveis no MMLight." }),
    },
    {
      id: "catalog.rate",
      tab: "catalogo",
      label: "Avaliar",
      icon: Star,
      description: "Dá estrelas (0 remove a avaliação).",
      params: [{ key: "stars", label: "Estrelas", type: "stepper", min: 0, max: 5, step: 1, default: 5 }, scope],
      run: rate,
    },
    {
      id: "catalog.mark",
      tab: "catalogo",
      label: "Sinalizar",
      icon: Flag,
      description: "Liga ou desliga a bandeira e define o rótulo de cor.",
      params: [
        { key: "flag", label: "Bandeira", type: "select", default: "on", options: [["keep", "Manter"], ["on", "Sinalizar"], ["off", "Tirar bandeira"]] },
        { key: "color", label: "Rótulo de cor", type: "select", default: "keep", options: [["keep", "Manter"], ...LIGHT_COLOR_LABELS.map((item) => [item, item || "Sem rótulo"])] },
        scope,
      ],
      run: mark,
    },
    {
      id: "catalog.collection",
      tab: "catalogo",
      label: "Coleção",
      icon: FolderPlus,
      description: "Adiciona as fotos a uma pasta ou coleção do catálogo.",
      params: [{ key: "entry", label: "Destino", type: "select", default: LIGHT_COLLECTIONS[0], options: entries }, scope],
      run: collect,
    },
    {
      id: "catalog.sync",
      tab: "catalogo",
      label: "Sincronizar",
      icon: CopyCheck,
      description: "Copia ajustes, perfil e máscaras da foto atual para as fotos selecionadas na tira.",
      how: "Selecione as outras fotos na tira com Ctrl+clique ou Shift+clique antes.",
      params: [],
      run: sync,
    },
  ];
  return { tabs: MMLIGHT_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMLightTool(toolId, state, params) {
  const tool = mmlightCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(
      { photos: {}, albums: {}, baseAdjust: DEFAULT_ADJUST, image: null, pickedIds: [], newId: (type) => `${type}-${Date.now()}`, ...state },
      { ...defaultsOf(tool), ...(params || {}) },
    );
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
