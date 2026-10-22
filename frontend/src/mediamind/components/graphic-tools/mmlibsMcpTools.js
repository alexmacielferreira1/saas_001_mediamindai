// Catálogo de ferramentas de um clique das Bibliotecas criativas (MM Library) para o MCP.
// `run` é pura sobre { assets, category, section, view, query, favorites, folders, openFolder, folderAssets,
// assetTags, trashed, newId } e devolve { ok, summary, count?, headline?, details?, items?, ...campos alterados }
// — o app grava só os campos devolvidos. Pastas, etiquetas e Lixeira são organização local da biblioteca:
// nenhuma ferramenta altera, move ou apaga o arquivo real do usuário.
import {
  ArchiveRestore,
  ArrowDownAZ,
  ClipboardList,
  CopyCheck,
  FilterX,
  FolderInput,
  FolderMinus,
  FolderPen,
  FolderPlus,
  FolderX,
  HeartOff,
  LayoutList,
  Search,
  Shapes,
  Star,
  Tags,
  Trash2,
} from "lucide-react";

export const MMLIBS_TABS = [
  { id: "filtrar", label: "Filtrar" },
  { id: "favoritos", label: "Favoritos" },
  { id: "pastas", label: "Pastas" },
  { id: "organizar", label: "Organizar" },
  { id: "relatorios", label: "Relatórios" },
];

export const LIBRARY_CATEGORIES = ["Todos", "Imagens", "Vídeos", "Áudio", "Documentos"];
export const ALL_ASSETS = "Todos os ativos";
export const FOLDERS_SECTION = "Pastas";
export const NO_FOLDER = "Sem pasta";
export const TAGS_SECTION = "Tags";
export const TRASH = "Lixeira";

/** Ativos com a categoria e a busca atuais; a busca procura no nome e nas etiquetas do ativo. */
export function filterAssets(assets, category, query, assetTags = {}) {
  const text = query.toLowerCase();
  return assets.filter(
    (asset) =>
      (asset.name.toLowerCase().includes(text) || (text !== "" && (assetTags[asset.id] || []).some((tag) => tag.includes(text)))) &&
      (category === "Todos" ||
        (category === "Imagens" && asset.type.startsWith("image")) ||
        (category === "Vídeos" && asset.type.startsWith("video")) ||
        (category === "Áudio" && asset.type.startsWith("audio")) ||
        (category === "Documentos" && !/^(image|video|audio)/.test(asset.type))),
  );
}

/** Ids guardados em pastas que ainda existem (pastas removidas não contam). */
const filedIds = (state) => new Set(state.folders.flatMap((folder) => (state.folderAssets || {})[folder.id] || []));

/**
 * Ativos que a grade mostra agora (mesma regra da tela): fora da Lixeira, os ativos da lixeira ficam ocultos;
 * "Sem pasta" mostra só os que não estão em pasta nenhuma; uma pasta aberta mostra só os ativos dela.
 */
export function visibleAssets(state) {
  const trashed = state.trashed || [];
  let pool = state.assets.filter((asset) => trashed.includes(asset.id) === (state.section === TRASH));
  if (state.section === NO_FOLDER) {
    const filed = filedIds(state);
    pool = pool.filter((asset) => !filed.has(asset.id));
  } else if (state.section === FOLDERS_SECTION && state.openFolder) {
    const ids = (state.folderAssets || {})[state.openFolder] || [];
    pool = pool.filter((asset) => ids.includes(asset.id));
  }
  return filterAssets(pool, state.category, state.query, state.assetTags);
}

/** Etiquetas em uso por ativos fora da Lixeira, com a quantidade de cada uma, em ordem alfabética. */
export function tagCounts(state) {
  const trashed = state.trashed || [];
  const counts = new Map();
  for (const asset of state.assets)
    if (!trashed.includes(asset.id)) for (const tag of (state.assetTags || {})[asset.id] || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}

class ToolError extends Error {}

const categoryOf = (asset) => LIBRARY_CATEGORIES.slice(1).find((category) => filterAssets([asset], category, "").length);
const listOf = (assets) => assets.map((asset) => ({ id: asset.id, label: asset.name, badge: categoryOf(asset) }));

/** Ativos marcados na lista do Analisar (sem lista: todos os candidatos). */
function pick(candidates, params, verb) {
  const chosen = params.selectedItems ? candidates.filter((asset) => params.selectedItems.includes(asset.id)) : candidates;
  if (!chosen.length) throw new ToolError(`Marque ao menos um ativo da lista para ${verb}.`);
  return chosen;
}

function showCategory(state, params) {
  const visible = visibleAssets({ ...state, category: params.category, section: ALL_ASSETS });
  return {
    ok: true,
    count: visible.length,
    summary: `Mostrando ${visible.length} ativo(s) em ${params.category}${state.query ? ` com a busca “${state.query}”` : ""}`,
    category: params.category,
    section: ALL_ASSETS,
  };
}

function search(state, params) {
  const query = (params.query || "").trim();
  if (!query) throw new ToolError("Digite o que procurar (nome do arquivo).");
  const visible = visibleAssets({ ...state, query, section: ALL_ASSETS });
  return { ok: true, count: visible.length, summary: `${visible.length} ativo(s) encontrado(s) para “${query}”`, query, section: ALL_ASSETS };
}

function clearFilters(state) {
  if (state.category === "Todos" && !state.query && state.section === ALL_ASSETS) throw new ToolError("Os filtros já estão limpos: todos os ativos aparecem.");
  const total = visibleAssets({ ...state, category: "Todos", query: "", section: ALL_ASSETS }).length;
  return { ok: true, count: total, summary: `Filtros limpos: ${total} ativo(s) à vista`, category: "Todos", query: "", section: ALL_ASSETS };
}

function setView(state, params) {
  const label = params.view === "grade" ? "grade" : "lista";
  if (state.view === params.view) throw new ToolError(`A biblioteca já está em ${label}.`);
  return { ok: true, count: 1, summary: `Visualização em ${label}`, view: params.view };
}

function favoriteVisible(state, params) {
  const candidates = visibleAssets(state).filter((asset) => !state.favorites.includes(asset.id));
  if (!candidates.length) throw new ToolError("Todos os ativos visíveis já são favoritos (ou não há ativos com os filtros atuais).");
  const chosen = pick(candidates, params, "favoritar");
  return {
    ok: true,
    count: chosen.length,
    summary: `${chosen.length} ativo(s) adicionado(s) aos favoritos`,
    items: listOf(candidates),
    favorites: [...state.favorites, ...chosen.map((asset) => asset.id)],
  };
}

function clearFavorites(state) {
  if (!state.favorites.length) throw new ToolError("Não há favoritos para remover.");
  return { ok: true, count: state.favorites.length, summary: `${state.favorites.length} favorito(s) removido(s) (os arquivos continuam na biblioteca)`, favorites: [] };
}

function validName(state, raw, ignoreId) {
  const name = (raw || "").trim();
  if (!name) throw new ToolError("Digite um nome para a pasta.");
  if (state.folders.some((folder) => folder.id !== ignoreId && folder.name.toLowerCase() === name.toLowerCase())) throw new ToolError(`Já existe uma pasta chamada “${name}”.`);
  return name;
}

function findFolder(state, id) {
  const folder = state.folders.find((item) => item.id === id);
  if (!folder) throw new ToolError("Escolha uma pasta existente.");
  return folder;
}

function createFolder(state, params) {
  const name = validName(state, params.name);
  return { ok: true, count: 1, summary: `Pasta “${name}” criada`, folders: [...state.folders, { id: state.newId(), name }] };
}

function renameFolder(state, params) {
  const folder = findFolder(state, params.folder);
  const name = validName(state, params.name, folder.id);
  if (name === folder.name) throw new ToolError("O novo nome é igual ao atual.");
  return { ok: true, count: 1, summary: `Pasta “${folder.name}” renomeada para “${name}”`, folders: state.folders.map((item) => (item.id === folder.id ? { ...item, name } : item)) };
}

function sortFolders(state) {
  const sorted = [...state.folders].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  if (sorted.every((folder, index) => folder === state.folders[index])) throw new ToolError("As pastas já estão em ordem alfabética.");
  return { ok: true, count: sorted.length, summary: `${sorted.length} pasta(s) em ordem alfabética`, folders: sorted };
}

const withoutFolder = (state, folderId) => Object.fromEntries(Object.entries(state.folderAssets).filter(([id]) => id !== folderId));

function removeFolder(state, params) {
  const folder = findFolder(state, params.folder);
  const result = {
    ok: true,
    count: 1,
    summary: `Pasta “${folder.name}” removida da lista (os ativos dela voltam para Sem pasta; nenhum arquivo foi apagado)`,
    folders: state.folders.filter((item) => item.id !== folder.id),
  };
  if ((state.folderAssets || {})[folder.id]) result.folderAssets = withoutFolder(state, folder.id);
  if (state.openFolder === folder.id) result.openFolder = "";
  return result;
}

function moveToFolder(state, params) {
  const folder = findFolder(state, params.folder);
  const inside = (state.folderAssets || {})[folder.id] || [];
  const candidates = visibleAssets(state).filter((asset) => !inside.includes(asset.id));
  if (!candidates.length) throw new ToolError(`Todos os ativos visíveis já estão em “${folder.name}” (ou não há ativos com os filtros atuais).`);
  const chosen = pick(candidates, params, "mover").map((asset) => asset.id);
  // Um ativo fica em uma pasta só: sai da pasta anterior ao entrar na nova.
  const folderAssets = Object.fromEntries(Object.entries(state.folderAssets || {}).map(([id, ids]) => [id, ids.filter((assetId) => !chosen.includes(assetId))]));
  folderAssets[folder.id] = [...inside, ...chosen];
  return {
    ok: true,
    count: chosen.length,
    summary: `${chosen.length} ativo(s) guardado(s) em “${folder.name}” (o arquivo não muda de lugar no computador)`,
    items: listOf(candidates),
    folderAssets,
  };
}

function emptyFolder(state, params) {
  const folder = findFolder(state, params.folder);
  const total = ((state.folderAssets || {})[folder.id] || []).length;
  if (!total) throw new ToolError(`A pasta “${folder.name}” já está vazia.`);
  return { ok: true, count: total, summary: `Pasta “${folder.name}” esvaziada: ${total} ativo(s) voltaram para Sem pasta (nenhum arquivo foi apagado)`, folderAssets: withoutFolder(state, folder.id) };
}

function tagAssets(state, params) {
  const tag = (params.tag || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!tag) throw new ToolError("Digite a etiqueta.");
  if (tag.length > 30) throw new ToolError("Use uma etiqueta de até 30 caracteres.");
  const tags = state.assetTags || {};
  const adding = params.action !== "remove";
  const candidates = visibleAssets(state).filter((asset) => (tags[asset.id] || []).includes(tag) !== adding);
  if (!candidates.length)
    throw new ToolError(adding ? `Todos os ativos visíveis já têm a etiqueta “${tag}” (ou não há ativos com os filtros atuais).` : `Nenhum ativo visível tem a etiqueta “${tag}”.`);
  const chosen = pick(candidates, params, adding ? "etiquetar" : "retirar a etiqueta").map((asset) => asset.id);
  const assetTags = { ...tags };
  for (const id of chosen) {
    const next = adding ? [...(tags[id] || []), tag] : tags[id].filter((item) => item !== tag);
    if (next.length) assetTags[id] = next;
    else delete assetTags[id];
  }
  return {
    ok: true,
    count: chosen.length,
    summary: adding ? `Etiqueta “${tag}” adicionada a ${chosen.length} ativo(s)` : `Etiqueta “${tag}” retirada de ${chosen.length} ativo(s)`,
    items: listOf(candidates),
    assetTags,
  };
}

function trashAssets(state, params) {
  if (state.section === TRASH) throw new ToolError("Você está na Lixeira: volte para Todos os ativos para escolher o que excluir.");
  const candidates = visibleAssets(state);
  if (!candidates.length) throw new ToolError("Não há ativos visíveis para mover para a Lixeira.");
  const chosen = pick(candidates, params, "excluir").map((asset) => asset.id);
  return {
    ok: true,
    count: chosen.length,
    summary: `${chosen.length} ativo(s) na Lixeira da biblioteca (nenhum arquivo foi apagado; restaure pela seção Lixeira)`,
    items: listOf(candidates),
    trashed: [...(state.trashed || []), ...chosen],
  };
}

function restoreAssets(state, params) {
  const trashed = state.trashed || [];
  const candidates = state.assets.filter((asset) => trashed.includes(asset.id));
  if (!candidates.length) throw new ToolError("A Lixeira está vazia.");
  const chosen = pick(candidates, params, "restaurar").map((asset) => asset.id);
  return { ok: true, count: chosen.length, summary: `${chosen.length} ativo(s) restaurado(s) da Lixeira`, items: listOf(candidates), trashed: trashed.filter((id) => !chosen.includes(id)) };
}

function inventory(state) {
  if (!state.assets.length) throw new ToolError("A biblioteca ainda não tem ativos.");
  const trashed = state.trashed || [];
  const live = state.assets.filter((asset) => !trashed.includes(asset.id));
  const counts = LIBRARY_CATEGORIES.slice(1).map((category) => [category, filterAssets(live, category, "").length]);
  const favorites = live.filter((asset) => state.favorites.includes(asset.id)).length;
  const tags = tagCounts(state).length;
  const inTrash = state.assets.length - live.length;
  return {
    ok: true,
    count: 0,
    headline: { count: live.length, text: "ativo(s) na biblioteca", aside: `${favorites} favorito(s)` },
    summary: counts.map(([category, total]) => `${category}: ${total}`).join(" · "),
    details: [
      ...counts.filter(([, total]) => total).map(([category, total]) => `${category}: ${total}`),
      `Pastas: ${state.folders.length}`,
      ...(tags ? [`Etiquetas: ${tags}`] : []),
      ...(inTrash ? [`Na Lixeira: ${inTrash}`] : []),
    ],
  };
}

function duplicates(state) {
  const groups = new Map();
  for (const asset of state.assets) {
    const key = `${asset.name.toLowerCase()}|${asset.type}`;
    groups.set(key, [...(groups.get(key) || []), asset]);
  }
  const repeated = [...groups.values()].filter((group) => group.length > 1);
  const extra = repeated.reduce((sum, group) => sum + group.length - 1, 0);
  return {
    ok: true,
    count: 0,
    headline: { count: extra, text: "cópia(s) com o mesmo nome e tipo" },
    summary: repeated.length ? `${repeated.length} nome(s) repetido(s); revise antes de usar nos editores (nada foi apagado).` : "Nenhum ativo repetido encontrado.",
    details: repeated.map((group) => `${group[0].name} × ${group.length}`),
  };
}

const folderParam = (folders) => ({
  key: "folder",
  label: "Pasta",
  type: "select",
  default: folders[0]?.id ?? "",
  options: folders.map((folder) => [folder.id, folder.name]),
});

export function mmlibsCatalogue(state = {}) {
  const folders = state.folders || [];
  const tools = [
    {
      id: "filter.category",
      tab: "filtrar",
      label: "Categoria",
      icon: Shapes,
      description: "Mostra só imagens, vídeos, áudios ou documentos (mantém a busca atual).",
      params: [{ key: "category", label: "Categoria", type: "chips", default: "Imagens", options: LIBRARY_CATEGORIES.map((category) => [category, category]) }],
      run: showCategory,
    },
    {
      id: "filter.search",
      tab: "filtrar",
      label: "Pesquisar",
      icon: Search,
      description: "Filtra os ativos pelo nome do arquivo ou pela etiqueta.",
      params: [{ key: "query", label: "Procurar por", type: "text", rows: 1, default: "", placeholder: "ex.: logo, entrevista, trilha" }],
      run: search,
    },
    { id: "filter.clear", tab: "filtrar", label: "Limpar filtros", icon: FilterX, description: "Volta a mostrar todos os ativos (categoria Todos, sem busca).", params: [], run: clearFilters },
    {
      id: "filter.view",
      tab: "filtrar",
      label: "Visualização",
      icon: LayoutList,
      description: "Alterna entre grade de miniaturas e lista compacta.",
      params: [
        {
          key: "view",
          label: "Mostrar em",
          type: "select",
          default: "lista",
          options: [
            ["grade", "Grade"],
            ["lista", "Lista"],
          ],
        },
      ],
      run: setView,
    },
    {
      id: "fav.visible",
      tab: "favoritos",
      label: "Favoritar visíveis",
      icon: Star,
      description: "Marca como favoritos os ativos que estão à vista com os filtros atuais.",
      how: "Analisar lista os ativos ainda não favoritos; desmarque os que não quiser e aplique.",
      params: [],
      run: favoriteVisible,
    },
    {
      id: "fav.clear",
      tab: "favoritos",
      label: "Limpar favoritos",
      icon: HeartOff,
      description: "Tira a estrela de todos os ativos. Os arquivos não são apagados.",
      confirm: "Remover todos os favoritos? Os arquivos continuam na biblioteca e dá para desfazer.",
      params: [],
      run: clearFavorites,
    },
    {
      id: "folder.create",
      tab: "pastas",
      label: "Nova pasta",
      icon: FolderPlus,
      description: "Cria uma pasta na barra lateral da biblioteca.",
      params: [{ key: "name", label: "Nome", type: "text", rows: 1, default: "Nova pasta" }],
      run: createFolder,
    },
    {
      id: "folder.rename",
      tab: "pastas",
      label: "Renomear",
      icon: FolderPen,
      description: "Troca o nome de uma pasta.",
      params: [folderParam(folders), { key: "name", label: "Novo nome", type: "text", rows: 1, default: "" }],
      run: renameFolder,
    },
    { id: "folder.sort", tab: "pastas", label: "Ordenar A–Z", icon: ArrowDownAZ, description: "Coloca as pastas em ordem alfabética.", params: [], run: sortFolders },
    {
      id: "folder.remove",
      tab: "pastas",
      label: "Remover pasta",
      icon: FolderMinus,
      description: "Tira uma pasta da lista; os ativos dela voltam para Sem pasta. Nenhum arquivo é apagado.",
      confirm: "Remover esta pasta da lista? Nenhum arquivo é apagado e dá para desfazer.",
      params: [folderParam(folders)],
      run: removeFolder,
    },
    {
      id: "assets.move",
      tab: "pastas",
      label: "Mover para pasta",
      icon: FolderInput,
      description: "Guarda os ativos visíveis numa pasta (cada ativo fica em uma pasta só). O arquivo não muda de lugar no computador.",
      how: "Analisar lista os ativos visíveis que ainda não estão na pasta; desmarque os que não quiser e aplique.",
      params: [folderParam(folders)],
      run: moveToFolder,
    },
    {
      id: "folder.empty",
      tab: "pastas",
      label: "Esvaziar pasta",
      icon: FolderX,
      description: "Tira todos os ativos de uma pasta (eles voltam para Sem pasta). Nenhum arquivo é apagado.",
      params: [folderParam(folders)],
      run: emptyFolder,
    },
    {
      id: "assets.tags",
      tab: "organizar",
      label: "Etiquetar",
      icon: Tags,
      description: "Adiciona ou retira uma etiqueta dos ativos visíveis. As etiquetas aparecem no cartão e entram na pesquisa.",
      how: "Analisar lista os ativos visíveis que serão alterados; desmarque os que não quiser e aplique.",
      params: [
        {
          key: "action",
          label: "Ação",
          type: "chips",
          default: "add",
          options: [
            ["add", "Adicionar"],
            ["remove", "Retirar"],
          ],
        },
        { key: "tag", label: "Etiqueta", type: "text", rows: 1, default: "", placeholder: "ex.: cliente, aprovado, 2026" },
      ],
      run: tagAssets,
    },
    {
      id: "assets.delete",
      tab: "organizar",
      label: "Excluir ativos",
      icon: Trash2,
      description: "Move os ativos visíveis para a Lixeira da biblioteca (somem da grade). O arquivo no computador não é apagado.",
      how: "Analisar lista os ativos visíveis; desmarque os que quiser manter e aplique. Para trazer de volta, use Restaurar ou a seção Lixeira.",
      confirm: "Mover os ativos marcados para a Lixeira da biblioteca? Nenhum arquivo é apagado e dá para restaurar.",
      params: [],
      run: trashAssets,
    },
    {
      id: "assets.restore",
      tab: "organizar",
      label: "Restaurar",
      icon: ArchiveRestore,
      description: "Traz de volta para a biblioteca os ativos que estão na Lixeira.",
      how: "Analisar lista os ativos da Lixeira; desmarque os que devem continuar lá e aplique.",
      params: [],
      run: restoreAssets,
    },
    {
      id: "report.inventory",
      tab: "relatorios",
      label: "Inventário",
      icon: ClipboardList,
      description: "Conta os ativos por categoria, favoritos, pastas, etiquetas e Lixeira. Não altera nada.",
      analyze: false,
      applyLabel: "Gerar relatório",
      params: [],
      run: inventory,
    },
    {
      id: "report.duplicates",
      tab: "relatorios",
      label: "Repetidos",
      icon: CopyCheck,
      description: "Encontra ativos com o mesmo nome e tipo (importados mais de uma vez). Não apaga nada.",
      analyze: false,
      applyLabel: "Procurar repetidos",
      params: [],
      run: duplicates,
    },
  ];
  return { tabs: MMLIBS_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMLibsTool(toolId, state, params) {
  const tool = mmlibsCatalogue(state).tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run({ newId: () => crypto.randomUUID(), ...state }, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
