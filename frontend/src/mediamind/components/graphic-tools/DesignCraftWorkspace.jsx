import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useState } from "react";
import {
  AlignLeft,
  Download,
  Eye,
  FileText,
  Grid3X3,
  Hand,
  Image,
  Link2,
  MousePointer2,
  PenTool,
  Plus,
  Save,
  Square,
  Type,
  Upload,
  ZoomIn,
} from "lucide-react";

const TOOLS = [
  ["V", "Seleção", MousePointer2],
  ["A", "Seleção direta", MousePointer2],
  ["T", "Texto", Type],
  ["F", "Quadro", Square],
  ["P", "Caneta", PenTool],
  ["L", "Linha", AlignLeft],
  ["H", "Mão", Hand],
  ["Z", "Zoom", ZoomIn],
];
const PAGES = ["A-Mestre", "1", "2–3", "4–5", "6–7", "8"];

export default function DesignCraftWorkspace({ assets, onOpenFiles }) {
  const [tool, setTool] = useGraphicDraftState("DesignCraftWorkspace.jsx:tool", "Seleção");
  const [page, setPage] = useGraphicDraftState("DesignCraftWorkspace.jsx:page", "2–3");
  const [panel, setPanel] = useGraphicDraftState("DesignCraftWorkspace.jsx:panel", "Propriedades");
  const [zoom, setZoom] = useGraphicDraftState("DesignCraftWorkspace.jsx:zoom", 58);
  const [layers, setLayers] = useGraphicDraftState("DesignCraftWorkspace.jsx:layers", [
    { name: "Textos", visible: true, color: "bg-blue-500" },
    { name: "Imagens", visible: true, color: "bg-red-500" },
    { name: "Elementos gráficos", visible: true, color: "bg-green-500" },
    { name: "Fundo", visible: true, color: "bg-amber-500" },
  ]);
  function toggleLayer(name) {
    setLayers((old) =>
      old.map((layer) =>
        layer.name === name ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }
  return (
    <section className="space-y-2 bg-[#171717] text-slate-200">
      <header className="flex items-center border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">DesignCraft</h1>
          <p className="text-[10px] text-slate-500">
            Publicação sem título · 8 páginas · CMYK
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Save size={14} className="mr-1 inline" />
            Salvar
          </button>
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Colocar
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.svg,.pdf,.txt,.md"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button className="rounded bg-fuchsia-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Download size={14} className="mr-1 inline" />
            Publicar PDF
          </button>
        </div>
      </header>
      <div className="flex gap-1 border-b border-slate-800 pb-1 text-[11px]">
        {[
          "Arquivo",
          "Editar",
          "Layout",
          "Texto",
          "Objeto",
          "Tabela",
          "Exibir",
          "Janela",
          "Ajuda",
        ].map((item) => (
          <button
            key={item}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
          >
            {item}
          </button>
        ))}
        <span className="ml-auto text-slate-500">
          Essenciais · Livro · Tipografia · Interativo
        </span>
      </div>
      <div className="grid min-h-[730px] grid-cols-[54px_235px_minmax(600px,1fr)_300px] gap-2">
        <aside className="flex flex-col items-center gap-1 rounded border border-slate-800 bg-[#242424] p-1">
          {TOOLS.map(([shortcut, name, Icon]) => (
            <button
              key={name}
              title={`${name} (${shortcut})`}
              onClick={() => setTool(name)}
              className={`grid h-9 w-9 place-items-center rounded ${tool === name ? "bg-fuchsia-500 text-white" : "hover:bg-slate-700"}`}
            >
              <Icon size={17} />
            </button>
          ))}
        </aside>
        <aside className="rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            <button className="flex-1 border-b-2 border-fuchsia-400 p-2 text-[10px] text-fuchsia-300">
              Páginas
            </button>
            <button className="flex-1 p-2 text-[10px] text-slate-500">
              Camadas
            </button>
            <button className="flex-1 p-2 text-[10px] text-slate-500">
              Links
            </button>
          </div>
          <div className="p-2">
            <p className="mb-2 text-[10px] font-bold">Páginas-mestre</p>
            <button className="mb-3 flex w-full items-center gap-2 rounded border border-slate-700 p-2 text-[10px]">
              <span className="grid h-12 w-9 place-items-center bg-white text-slate-900">
                A
              </span>
              A-Mestre
            </button>
            <p className="mb-2 text-[10px] font-bold">Páginas do documento</p>
            <div className="grid grid-cols-2 gap-2">
              {PAGES.slice(1).map((item) => (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  className={`grid h-20 place-items-center rounded border bg-white text-xs font-bold text-slate-900 ${page === item ? "border-4 border-fuchsia-400" : "border-slate-500"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-slate-700 p-2 text-[10px]">
              <Plus size={12} />
              Adicionar página
            </button>
          </div>
          <div className="border-t border-slate-700 p-2">
            <p className="mb-2 text-[10px] font-bold">Camadas</p>
            {layers.map((layer) => (
              <button
                key={layer.name}
                onClick={() => toggleLayer(layer.name)}
                className="mb-1 flex w-full items-center gap-2 rounded border border-slate-700 p-2 text-[10px]"
              >
                <Eye size={11} className={layer.visible ? "" : "opacity-30"} />
                <span className={`h-3 w-3 ${layer.color}`} />
                {layer.name}
              </button>
            ))}
          </div>
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#353535]">
          <div className="flex items-center gap-3 border-b border-slate-700 bg-[#242424] p-2 text-[10px]">
            <b>{tool}</b>
            <span>X: 0 mm</span>
            <span>Y: 0 mm</span>
            <span>L: 210 mm</span>
            <span>A: 297 mm</span>
            <span className="ml-auto">Páginas {page}</span>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-10">
            <div
              className="grid grid-cols-2 gap-1 shadow-2xl"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              <article className="relative h-[650px] w-[460px] overflow-hidden bg-[#f7f2e8] p-10 text-slate-900">
                <div className="absolute left-0 top-0 h-full w-3 bg-fuchsia-600" />
                <p className="text-xs font-bold uppercase tracking-[.3em] text-fuchsia-700">
                  MediaMind Editorial
                </p>
                <h2 className="mt-10 text-6xl font-black leading-[.9]">
                  DESIGN
                  <br />
                  QUE CONECTA
                </h2>
                <p className="mt-8 w-72 text-lg">
                  Uma publicação criada com controle editorial, identidade e
                  precisão tipográfica.
                </p>
                <div className="absolute bottom-10 left-10 right-10 h-52 overflow-hidden bg-gradient-to-br from-fuchsia-500 via-indigo-500 to-cyan-400">
                  <Grid3X3
                    className="absolute right-8 top-8 text-white/70"
                    size={90}
                  />
                </div>
                <span className="absolute bottom-4 right-5 text-xs">2</span>
              </article>
              <article className="relative h-[650px] w-[460px] bg-white p-10 text-slate-900">
                <h3 className="text-3xl font-black">Conteúdo com estrutura</h3>
                <div className="mt-4 h-1 w-20 bg-fuchsia-500" />
                <div className="mt-8 grid grid-cols-2 gap-6 text-sm leading-relaxed">
                  <p>
                    O fluxo editorial combina páginas-mestre, estilos de
                    parágrafo, grades, margens e objetos ancorados para manter
                    consistência.
                  </p>
                  <p>
                    Textos podem percorrer quadros encadeados enquanto imagens
                    respeitam contorno e sangria definidos no documento.
                  </p>
                </div>
                <div className="mt-8 grid h-64 place-items-center border-2 border-dashed border-fuchsia-400 bg-slate-100">
                  <Image size={60} className="text-fuchsia-400" />
                  <span className="absolute mt-24 text-xs text-slate-500">
                    Quadro de imagem vinculado
                  </span>
                </div>
                <div className="mt-8 columns-2 gap-6 text-xs leading-relaxed">
                  <p>
                    Estilos de objeto, caracteres, parágrafos e tabelas permitem
                    produzir documentos extensos com padronização. O pacote
                    final inclui vínculos, fontes e relatório de preflight.
                  </p>
                  <p>
                    A exportação oferece PDF/X, marcas de corte, sangria, perfis
                    CMYK e recursos interativos quando necessários.
                  </p>
                </div>
                <span className="absolute bottom-4 left-5 text-xs">3</span>
              </article>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-700 bg-[#242424] p-2 text-[10px]">
            <span>
              Preflight: <b className="text-emerald-400">Sem erros</b>
            </span>
            <span>2 vínculos</span>
            <span>4 fontes</span>
            <input
              type="range"
              min="25"
              max="100"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              className="ml-auto accent-fuchsia-400"
            />
            <span>{zoom}%</span>
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            {["Propriedades", "Estilos", "Recursos"].map((name) => (
              <button
                key={name}
                onClick={() => setPanel(name)}
                className={`flex-1 p-2 text-[10px] ${panel === name ? "border-b-2 border-fuchsia-400 text-fuchsia-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {panel === "Propriedades" && (
            <div className="space-y-3 p-3">
              <h3 className="text-xs font-bold">Quadro selecionado</h3>
              {[
                ["X", "20 mm"],
                ["Y", "32 mm"],
                ["Largura", "170 mm"],
                ["Altura", "64 mm"],
              ].map(([a, b]) => (
                <label
                  key={a}
                  className="flex justify-between rounded border border-slate-700 p-2 text-[10px]"
                >
                  {a}
                  <input
                    defaultValue={b}
                    className="w-20 bg-transparent text-right"
                  />
                </label>
              ))}
              <h3 className="pt-2 text-xs font-bold">Texto</h3>
              <select className="w-full rounded border border-slate-700 bg-[#171717] p-2 text-xs">
                <option>Inter</option>
                <option>Montserrat</option>
                <option>Source Serif</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded border border-slate-700 p-2 text-[10px]">
                  Semibold · 32 pt
                </button>
                <button className="rounded border border-slate-700 p-2 text-[10px]">
                  Entrelinha 38 pt
                </button>
              </div>
              <button className="w-full rounded border border-slate-700 p-2 text-[10px]">
                Contorno de texto
              </button>
            </div>
          )}
          {panel === "Estilos" && (
            <div className="space-y-2 p-3">
              {[
                "Título principal",
                "Subtítulo",
                "Corpo",
                "Legenda",
                "Crédito",
                "Citação",
              ].map((item) => (
                <button
                  key={item}
                  className="flex w-full items-center justify-between rounded border border-slate-700 p-2 text-[10px]"
                >
                  <span>{item}</span>
                  <span>¶</span>
                </button>
              ))}
            </div>
          )}
          {panel === "Recursos" && (
            <div className="p-3">
              <h3 className="mb-2 text-xs font-bold">Vínculos</h3>
              {assets.map((asset) => (
                <p
                  key={asset.id}
                  className="mb-1 flex items-center gap-2 rounded border border-slate-700 p-2 text-[10px]"
                >
                  <Link2 size={12} />
                  {asset.name}
                </p>
              ))}
              {!assets.length && (
                <p className="text-[10px] text-slate-500">
                  Nenhum vínculo colocado.
                </p>
              )}
            </div>
          )}
          <div className="border-t border-slate-700 p-3">
            <h3 className="mb-2 text-xs font-bold">Exportação</h3>
            {[
              ["Padrão PDF", "PDF/X-4"],
              ["Páginas", "Todas"],
              ["Sangria", "3 mm"],
              ["Marcas", "Corte"],
              ["Cor", "CMYK Coated FOGRA"],
            ].map(([a, b]) => (
              <button
                key={a}
                className="mb-1 flex w-full justify-between rounded border border-slate-700 p-2 text-[10px]"
              >
                <span>{a}</span>
                <span>{b} ▾</span>
              </button>
            ))}
            <button className="mt-2 w-full rounded bg-fuchsia-400 p-2 text-xs font-bold text-slate-950">
              <FileText size={13} className="mr-1 inline" />
              Exportar publicação
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
