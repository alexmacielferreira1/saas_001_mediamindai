import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useEffect, useMemo, useRef, useState } from "react";
import { registerMCPActions } from "../../lib/mcpActions";
import { ALL_ASSETS, FOLDERS_SECTION, TAGS_SECTION, TRASH, mmlibsCatalogue, runMMLibsTool, tagCounts, visibleAssets } from "./mmlibsMcpTools";
import {
  Box,
  Folder,
  FileText,
  FolderPlus,
  Grid2X2,
  Image,
  List,
  Music,
  Play,
  Search,
  Star,
  Tags,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

const CATEGORIES = [
  ["Todos", Box],
  ["Imagens", Image],
  ["Vídeos", Video],
  ["Áudio", Music],
  ["Documentos", FileText],
];

export default function CraftLibraryWorkspace({
  active = true,
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [category, setCategory] = useGraphicDraftState("CraftLibraryWorkspace.jsx:category", "Todos");
  const [section, setSection] = useGraphicDraftState("CraftLibraryWorkspace.jsx:section", "Todos os ativos");
  const [view, setView] = useGraphicDraftState("CraftLibraryWorkspace.jsx:view", "grade");
  const [query, setQuery] = useGraphicDraftState("CraftLibraryWorkspace.jsx:query", "");
  const [favorites, setFavorites] = useGraphicDraftState("CraftLibraryWorkspace.jsx:favorites", []);
  const [folders, setFolders] = useGraphicDraftState("CraftLibraryWorkspace.jsx:folders", [
    { id: "projetos", name: "Projetos" },
    { id: "identidade", name: "Identidade visual" },
    { id: "referencias", name: "Referências" },
  ]);
  // Organização local da biblioteca (não mexe nos arquivos): ativos por pasta, etiquetas por ativo,
  // Lixeira (ativos ocultos que podem ser restaurados) e a pasta aberta na seção Pastas.
  const [folderAssets, setFolderAssets] = useGraphicDraftState("CraftLibraryWorkspace.jsx:folderAssets", {});
  const [assetTags, setAssetTags] = useGraphicDraftState("CraftLibraryWorkspace.jsx:assetTags", {});
  const [trashed, setTrashed] = useGraphicDraftState("CraftLibraryWorkspace.jsx:trashed", []);
  const [openFolder, setOpenFolder] = useGraphicDraftState("CraftLibraryWorkspace.jsx:openFolder", "");
  const createFolder = () => {
    const name = window.prompt("Nome da nova pasta", "Nova pasta")?.trim();
    if (name)
      setFolders((current) => [...current, { id: crypto.randomUUID(), name }]);
  };
  const filtered = useMemo(
    () => visibleAssets({ assets, category, query, section, openFolder, folders, folderAssets, assetTags, trashed }),
    [assets, category, query, section, openFolder, folders, folderAssets, assetTags, trashed],
  );
  const tags = useMemo(() => tagCounts({ assets, assetTags, trashed }), [assets, assetTags, trashed]);
  const liveIds = new Set(assets.filter((asset) => !trashed.includes(asset.id)).map((asset) => asset.id));
  const currentFolder = section === FOLDERS_SECTION ? folders.find((folder) => folder.id === openFolder) : undefined;
  const showGrid = section === FOLDERS_SECTION ? Boolean(currentFolder) : section !== TAGS_SECTION;
  const restore = (ids) => setTrashed((current) => current.filter((id) => !ids.includes(id)));
  // Ferramentas de um clique do MCP (grade de ícones no Copiloto): organizam filtros, favoritos, pastas,
  // etiquetas e Lixeira pelos mesmos estados da biblioteca; nenhuma apaga arquivos. A biblioteca não tem desfazer
  // próprio: o MCP guarda o estado anterior e só desfaz se ninguém mexeu depois nos mesmos campos.
  const [notice, setNotice] = useState("");
  const libraryRef = useRef(null);
  libraryRef.current = { assets, category, section, view, query, favorites, folders, openFolder, folderAssets, assetTags, trashed };
  const settersRef = useRef(null);
  settersRef.current = {
    category: setCategory,
    section: setSection,
    view: setView,
    query: setQuery,
    favorites: setFavorites,
    folders: setFolders,
    openFolder: setOpenFolder,
    folderAssets: setFolderAssets,
    assetTags: setAssetTags,
    trashed: setTrashed,
  };
  const mcpHistory = useRef([]);
  useEffect(() => {
    if (!active) return undefined;
    const FIELDS = ["category", "section", "view", "query", "favorites", "folders", "openFolder", "folderAssets", "assetTags", "trashed"];
    const strip = (result) => Object.fromEntries(Object.entries(result).filter(([key]) => !FIELDS.includes(key)));
    const write = (values) => {
      libraryRef.current = { ...libraryRef.current, ...values };
      for (const [field, value] of Object.entries(values)) settersRef.current[field](value);
    };
    return registerMCPActions({
      source: "mmlibs",
      label: "Bibliotecas",
      catalogue: () => mmlibsCatalogue(libraryRef.current),
      analyze: async (toolId, params) => {
        const result = runMMLibsTool(toolId, libraryRef.current, params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runMMLibsTool(toolId, libraryRef.current, params);
        if (result.ok) {
          const changed = FIELDS.filter((field) => field in result && result[field] !== libraryRef.current[field]);
          if (changed.length) {
            const before = Object.fromEntries(changed.map((field) => [field, libraryRef.current[field]]));
            const after = Object.fromEntries(changed.map((field) => [field, result[field]]));
            write(after);
            mcpHistory.current.push({ before, after });
          }
          setNotice(`MCP · ${result.summary}`);
        }
        return strip(result);
      },
      undo: () => {
        const last = mcpHistory.current.at(-1);
        if (!last) return false;
        if (Object.entries(last.after).some(([field, value]) => libraryRef.current[field] !== value)) {
          mcpHistory.current = [];
          setNotice("A biblioteca mudou depois da ação do MCP: desfazer cancelado para não perder suas alterações.");
          return false;
        }
        mcpHistory.current.pop();
        write(last.before);
        setNotice("MCP · Última ação desfeita.");
        return true;
      },
      canUndo: () => mcpHistory.current.length > 0,
    });
  }, [active]);
  return (
    <section className="space-y-3">
      <header className="flex items-center">
        <div>
          <h1 className="text-2xl font-black text-white">MM Library</h1>
          <p className="text-xs text-slate-400">
            Biblioteca comum dos sete editores, com ativos, presets e
            componentes compartilhados
          </p>
          {notice && (
            <p role="status" className="mt-1 text-[11px] text-cyan-300">
              {notice}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/estudio-de-arte"
            className="rounded border border-slate-600 px-3 py-2 text-xs font-bold hover:bg-slate-800"
          >
            <Image size={14} className="mr-1 inline" /> Criar imagem
          </a>
          <a
            href="/ferramentas-ia?tool=video-studio"
            className="rounded border border-slate-600 px-3 py-2 text-xs font-bold hover:bg-slate-800"
          >
            <Play size={14} className="mr-1 inline" /> Criar vídeo
          </a>
          <label className="cursor-pointer rounded bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950">
            <Upload size={14} className="mr-1 inline" />
            Adicionar ativos
            <input
              hidden
              multiple
              type="file"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
        </div>
      </header>
      <div className="grid min-h-[680px] grid-cols-[230px_minmax(600px,1fr)_280px] gap-3">
        <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <h3 className="mb-3 text-xs font-bold">Biblioteca</h3>
          {[ALL_ASSETS, FOLDERS_SECTION, "Sem pasta", TAGS_SECTION, TRASH].map((name) => (
            <button
              key={name}
              onClick={() => {
                setSection(name);
                if (name === FOLDERS_SECTION) setOpenFolder("");
              }}
              className={`mb-1 flex w-full items-center gap-2 rounded p-2 text-xs ${section === name ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-800"}`}
            >
              {name === "Pastas" ? (
                <Folder size={14} />
              ) : name === "Tags" ? (
                <Tags size={14} />
              ) : name === TRASH ? (
                <Trash2 size={14} />
              ) : (
                <Box size={14} />
              )}
              {name}
              {name === TRASH && trashed.length > 0 && <span className="ml-auto">{trashed.length}</span>}
            </button>
          ))}
          <div className="my-3 border-t border-slate-800" />
          {CATEGORIES.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={`mb-1 flex w-full items-center gap-2 rounded p-2 text-xs ${category === name ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400"}`}
            >
              <Icon size={14} />
              {name}
              <span className="ml-auto">{assets.length}</span>
            </button>
          ))}
          <h3 className="mb-2 mt-5 text-xs font-bold">Pastas</h3>
          {folders.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSection(FOLDERS_SECTION);
                setOpenFolder(item.id);
              }}
              className={`mb-1 block w-full rounded p-2 text-left text-[10px] ${currentFolder?.id === item.id ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-800"}`}
            >
              ▸ {item.name}
            </button>
          ))}
          <button
            onClick={createFolder}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-dashed border-slate-600 p-2 text-xs"
          >
            <FolderPlus size={13} />
            Nova pasta
          </button>
        </aside>
        <main className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar ativos, tags, pessoas ou projetos"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </label>
            <button
              aria-label="Visualização em grade"
              onClick={() => setView("grade")}
              className={`rounded border p-2.5 ${view === "grade" ? "border-cyan-400 text-cyan-300" : "border-slate-700"}`}
            >
              <Grid2X2 size={15} />
            </button>
            <button
              aria-label="Visualização em lista"
              onClick={() => setView("lista")}
              className={`rounded border p-2.5 ${view === "lista" ? "border-cyan-400 text-cyan-300" : "border-slate-700"}`}
            >
              <List size={15} />
            </button>
          </div>
          {section === FOLDERS_SECTION && !currentFolder && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setOpenFolder(folder.id)}
                  className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-4 text-left hover:border-cyan-500"
                >
                  <Folder className="text-amber-400" />
                  <span>
                    <strong className="block text-xs">{folder.name}</strong>
                    <small className="text-slate-500">{(folderAssets[folder.id] || []).filter((id) => liveIds.has(id)).length} ativos</small>
                  </span>
                </button>
              ))}
              <button
                onClick={createFolder}
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 p-4 text-xs text-slate-400"
              >
                <FolderPlus size={18} /> Nova pasta
              </button>
            </div>
          )}
          {currentFolder && (
            <div className="mt-4 flex items-center gap-2 text-xs">
              <button onClick={() => setOpenFolder("")} className="rounded border border-slate-700 px-2 py-1 text-slate-400 hover:bg-slate-800">
                ← Todas as pastas
              </button>
              <Folder size={14} className="text-amber-400" />
              <strong>{currentFolder.name}</strong>
            </div>
          )}
          {section === TRASH && filtered.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              Ativos ocultos da biblioteca. Os arquivos não foram apagados.
              <button onClick={() => restore(filtered.map((asset) => asset.id))} className="ml-auto rounded border border-slate-600 px-2 py-1 font-bold hover:bg-slate-800">
                Restaurar todos
              </button>
            </div>
          )}
          {showGrid && (
            <div
              className={`mt-4 ${view === "grade" ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" : "space-y-1"}`}
            >
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset)}
                  className={`group relative overflow-hidden border bg-slate-900 text-left ${view === "grade" ? "rounded-lg border-slate-700" : "flex items-center rounded border-slate-800"} ${selected?.id === asset.id ? "border-cyan-400" : ""}`}
                >
                  {asset.type.startsWith("image") ? (
                    <img
                      src={asset.url}
                      alt=""
                      className={
                        view === "grade"
                          ? "h-28 w-full object-cover"
                          : "h-12 w-16 object-cover"
                      }
                    />
                  ) : (
                    <div
                      className={`grid place-items-center bg-slate-950 ${view === "grade" ? "h-28" : "h-12 w-16"}`}
                    >
                      <Box className="text-cyan-300" />
                    </div>
                  )}
                  <p className="truncate p-2 text-[10px]">{asset.name}</p>
                  {assetTags[asset.id]?.length > 0 && (
                    <p className="truncate px-2 pb-2 text-[9px] text-cyan-300">{assetTags[asset.id].map((tag) => `#${tag}`).join(" ")}</p>
                  )}
                  {section === TRASH ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Restaurar ${asset.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        restore([asset.id]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          restore([asset.id]);
                        }
                      }}
                      className="absolute right-2 top-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300"
                    >
                      Restaurar
                    </span>
                  ) : (
                  <Star
                    onClick={(e) => {
                      e.stopPropagation();
                      setFavorites((old) =>
                        old.includes(asset.id)
                          ? old.filter((id) => id !== asset.id)
                          : [...old, asset.id],
                      );
                    }}
                    size={15}
                    className={`absolute right-2 top-2 ${favorites.includes(asset.id) ? "fill-amber-400 text-amber-400" : "text-white"}`}
                  />
                  )}
                </button>
              ))}
            </div>
          )}
          {section === TAGS_SECTION &&
            (tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map(([tag, total]) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      setSection(ALL_ASSETS);
                    }}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-cyan-300 hover:border-cyan-500"
                  >
                    #{tag} <span className="text-slate-500">{total}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-10 text-center text-xs text-slate-500">
                As tags aparecerão aqui quando forem atribuídas aos ativos.
              </div>
            ))}
          {!filtered.length && showGrid && (
            <div className="grid min-h-[420px] place-items-center text-center">
              <div>
                {section === TRASH ? <Trash2 size={50} className="mx-auto text-cyan-400" /> : <Box size={50} className="mx-auto text-cyan-400" />}
                <h2 className="mt-3 text-lg font-bold">
                  {section === TRASH ? "Lixeira vazia" : currentFolder ? "Pasta vazia" : "Biblioteca compartilhada"}
                </h2>
                <p className="text-xs text-slate-500">
                  {section === TRASH
                    ? "Ativos excluídos da biblioteca aparecem aqui para restaurar."
                    : currentFolder
                      ? "Guarde ativos nesta pasta pelo MCP (Pastas › Mover para pasta)."
                      : "Adicione ativos para utilizá-los em qualquer editor Craft."}
                </p>
              </div>
            </div>
          )}
        </main>
        <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <h3 className="text-xs font-bold">Motores compartilhados</h3>
          {[
            "Gestão de cor ICC",
            "Renderização GPU",
            "Codecs de mídia",
            "Fontes e tipografia",
            "Histórico não destrutivo",
            "Cache e proxies",
            "Importação e exportação",
          ].map((item) => (
            <div
              key={item}
              className="mt-2 rounded border border-slate-800 p-3 text-[10px]"
            >
              <span className="mr-2 text-emerald-400">●</span>
              {item}
            </div>
          ))}
          <h3 className="mt-5 text-xs font-bold">Uso</h3>
          <div className="mt-2 rounded border border-cyan-900 bg-cyan-950/20 p-3 text-xs text-cyan-200">
            {assets.length} ativos · {favorites.length} favoritos
            {trashed.length > 0 && ` · ${trashed.length} na Lixeira`}
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            Nesta fase, a biblioteca atende somente Ferramentas Gráficas. A
            integração com o restante do MediaMind será feita depois.
          </p>
        </aside>
      </div>
    </section>
  );
}
