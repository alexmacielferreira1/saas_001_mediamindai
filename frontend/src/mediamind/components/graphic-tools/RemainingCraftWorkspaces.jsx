import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  FolderPlus,
  Grid3X3,
  Image,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Upload,
} from "lucide-react";

export function LightCraftWorkspace({
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [module, setModule] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:module", "Revelação");
  const [rating, setRating] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:rating", 4);
  const [adjust, setAdjust] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:adjust", {
    exposição: 0,
    contraste: 0,
    realces: -18,
    sombras: 24,
    brancos: 5,
    pretos: -8,
    textura: 10,
    claridade: 8,
    saturação: 4,
  });
  const source =
    selected || assets.find((asset) => asset.type.startsWith("image"));
  const style = useMemo(
    () => ({
      filter: `brightness(${100 + adjust.exposição * 2}%) contrast(${100 + adjust.contraste}%) saturate(${100 + adjust.saturação}%)`,
    }),
    [adjust],
  );
  return (
    <section className="space-y-2 bg-[#17191c] text-slate-200">
      <header className="flex items-center border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold">LightCraft</h1>
          <p className="text-[10px] text-slate-500">
            Catálogo MediaMind · revelação RAW não destrutiva
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Importar fotos
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.dng,.raw,.cr2,.nef,.arw"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button className="rounded bg-teal-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Download size={14} className="mr-1 inline" />
            Exportar
          </button>
        </div>
      </header>
      <nav className="flex justify-end gap-1 border-b border-slate-800 pb-1">
        {[
          "Biblioteca",
          "Revelação",
          "Mapa",
          "Livro",
          "Apresentação",
          "Imprimir",
        ].map((item) => (
          <button
            key={item}
            onClick={() => setModule(item)}
            className={`rounded px-3 py-1.5 text-xs ${module === item ? "bg-teal-500/20 text-teal-300" : "text-slate-500"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="grid min-h-[720px] grid-cols-[235px_minmax(650px,1fr)_285px] gap-2">
        <aside className="rounded border border-slate-800 bg-[#202327] p-2">
          <label className="flex items-center gap-2 rounded border border-slate-700 bg-[#111317] p-2">
            <Search size={13} />
            <input
              placeholder="Pesquisar no catálogo"
              className="min-w-0 bg-transparent text-xs outline-none"
            />
          </label>
          <h3 className="mt-4 text-xs font-bold">Catálogo</h3>
          {[
            "Todas as fotografias",
            "Coleção rápida",
            "Importação anterior",
            "Fotos sinalizadas",
            "Cinco estrelas",
          ].map((item) => (
            <button
              key={item}
              className="mt-1 flex w-full justify-between rounded px-2 py-1.5 text-left text-[10px] hover:bg-slate-700"
            >
              <span>{item}</span>
              <span>{assets.length || 0}</span>
            </button>
          ))}
          <h3 className="mt-4 text-xs font-bold">Pastas</h3>
          {["2026", "Fronteiras da Saúde", "Eventos", "Institucional"].map(
            (item) => (
              <button
                key={item}
                className="mt-1 block w-full rounded px-2 py-1 text-left text-[10px]"
              >
                ▸ {item}
              </button>
            ),
          )}
          <h3 className="mt-4 text-xs font-bold">Coleções</h3>
          {["Selecionadas", "Publicação", "Retratos", "SIMERS"].map((item) => (
            <button
              key={item}
              className="mt-1 block w-full rounded px-2 py-1 text-left text-[10px]"
            >
              ▸ {item}
            </button>
          ))}
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#101214]">
          <div className="flex items-center gap-2 border-b border-slate-800 p-2 text-[10px]">
            <button>Antes</button>
            <button className="text-teal-300">Depois</button>
            <button>Comparar Y|Y</button>
            <span className="ml-auto">
              Ajustar: Automático · Perfil: Adobe Color
            </span>
          </div>
          <div className="grid flex-1 place-items-center p-8">
            {source?.type.startsWith("image") ? (
              <img
                src={source.url}
                alt=""
                style={style}
                className="max-h-[560px] max-w-full shadow-2xl"
              />
            ) : (
              <div className="text-center">
                <Image size={70} className="mx-auto text-teal-400" />
                <h2 className="mt-3 text-xl font-bold">Revelação RAW</h2>
                <p className="text-sm text-slate-500">
                  Importe uma fotografia para começar.
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 p-2">
            <div className="mb-2 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star
                    size={15}
                    className={
                      n <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-600"
                    }
                  />
                </button>
              ))}
              <span className="ml-3 text-[10px] text-slate-500">
                Bandeira · Cor · Avaliação
              </span>
            </div>
            <div className="flex h-20 gap-2 overflow-x-auto">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset)}
                  className={`min-w-24 overflow-hidden rounded border ${selected?.id === asset.id ? "border-teal-400" : "border-slate-700"}`}
                >
                  {asset.type.startsWith("image") ? (
                    <img
                      src={asset.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    asset.name
                  )}
                </button>
              ))}
            </div>
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-800 bg-[#202327] p-3">
          <div className="mb-3 h-24 rounded bg-[linear-gradient(90deg,#111_0%,#ddd_35%,#555_50%,#eee_75%,#222_100%)] opacity-80" />
          <h3 className="mb-2 text-xs font-bold">Histograma RGB</h3>
          <select className="mb-3 w-full rounded border border-slate-700 bg-[#111317] p-2 text-xs">
            <option>Perfil: Adobe Color</option>
            <option>Camera Standard</option>
            <option>Monocromático</option>
          </select>
          {Object.entries(adjust).map(([key, value]) => (
            <label
              key={key}
              className="mb-2 block text-[10px] capitalize text-slate-500"
            >
              <span className="flex justify-between">
                <span>{key}</span>
                <span>{value}</span>
              </span>
              <input
                type="range"
                min="-100"
                max="100"
                value={value}
                onChange={(e) =>
                  setAdjust((old) => ({ ...old, [key]: +e.target.value }))
                }
                className="w-full accent-teal-400"
              />
            </label>
          ))}
          <h3 className="mt-4 text-xs font-bold">Máscaras</h3>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {["Assunto", "Céu", "Pessoas", "Pincel", "Linear", "Radial"].map(
              (item) => (
                <button
                  key={item}
                  className="rounded border border-slate-700 p-2 text-[9px]"
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <button className="mt-3 w-full rounded bg-teal-400 p-2 text-xs font-bold text-slate-950">
            Sincronizar ajustes
          </button>
        </aside>
      </div>
    </section>
  );
}

export function PdfCraftWorkspace({ assets, selected, onSelect, onOpenFiles }) {
  const [mode, setMode] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:mode", "Editar");
  const source =
    selected || assets.find((asset) => asset.type === "application/pdf");
  return (
    <section className="space-y-2 bg-[#f4f5f7] text-slate-800 dark:bg-[#17191c] dark:text-slate-200">
      <header className="flex items-center border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold">PDFCraft</h1>
          <p className="text-[10px] text-slate-500">
            Leitura, edição, organização e assinatura de documentos
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <label className="cursor-pointer rounded border border-slate-600 px-3 py-2 text-xs">
            <FolderPlus size={14} className="mr-1 inline" />
            Abrir PDF
            <input
              hidden
              multiple
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button className="rounded bg-red-500 px-3 py-2 text-xs font-bold text-white">
            <Download size={14} className="mr-1 inline" />
            Salvar cópia
          </button>
        </div>
      </header>
      <div className="flex gap-1 overflow-x-auto rounded border border-slate-700 bg-[#22252a] p-1">
        {[
          ["Editar", FileText],
          ["Comentar", SlidersHorizontal],
          ["Organizar", Grid3X3],
          ["Preencher e assinar", FileSignature],
          ["Proteger", ShieldCheck],
          ["Exportar", Download],
        ].map(([name, Icon]) => (
          <button
            key={name}
            onClick={() => setMode(name)}
            className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${mode === name ? "bg-red-500 text-white" : "text-slate-400"}`}
          >
            <Icon size={14} />
            {name}
          </button>
        ))}
      </div>
      <div className="grid min-h-[720px] grid-cols-[220px_minmax(650px,1fr)_290px] gap-2">
        <aside className="rounded border border-slate-700 bg-[#22252a] text-slate-200">
          <div className="flex border-b border-slate-700">
            <button className="flex-1 border-b-2 border-red-400 p-2 text-[10px] text-red-300">
              Miniaturas
            </button>
            <button className="flex-1 p-2 text-[10px] text-slate-500">
              Marcadores
            </button>
          </div>
          <div className="space-y-2 p-3">
            {assets.map((asset, index) => (
              <button
                key={asset.id}
                onClick={() => onSelect(asset)}
                className={`flex w-full items-center gap-2 rounded border p-2 text-left text-[10px] ${selected?.id === asset.id ? "border-red-400" : "border-slate-700"}`}
              >
                <span className="grid h-16 w-12 place-items-center bg-white font-bold text-slate-900">
                  {index + 1}
                </span>
                <span className="truncate">{asset.name}</span>
              </button>
            ))}
            {!assets.length &&
              [1, 2, 3].map((n) => (
                <button
                  key={n}
                  className="mx-auto grid h-28 w-20 place-items-center border bg-white text-xs font-bold text-slate-800"
                >
                  {n}
                </button>
              ))}
          </div>
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-700 bg-[#3b3d42]">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-[#22252a] p-2 text-[10px] text-slate-300">
            <button>−</button>
            <span>100%</span>
            <button>+</button>
            <span className="mx-auto">
              Página 1 de {Math.max(1, assets.length)}
            </span>
            <button>↶</button>
            <button>↷</button>
          </div>
          <div className="grid flex-1 place-items-center overflow-hidden p-6">
            {source ? (
              <iframe
                title={source.name}
                src={source.url}
                className="h-full min-h-[600px] w-full bg-white"
              />
            ) : (
              <article className="min-h-[600px] w-[460px] bg-white p-12 text-slate-900 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-[.3em] text-red-600">
                  Documento MediaMind
                </p>
                <h2 className="mt-8 text-4xl font-black">
                  Relatório institucional
                </h2>
                <p className="mt-6 leading-relaxed">
                  Abra um arquivo PDF para leitura, edição, comentários,
                  formulários, organização de páginas e assinatura.
                </p>
                <div className="mt-10 h-44 rounded bg-gradient-to-br from-red-500 to-orange-300" />
                <p className="mt-8 text-sm leading-relaxed">
                  As ferramentas permanecem isoladas nesta fase e serão
                  integradas ao acervo posteriormente.
                </p>
              </article>
            )}
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-700 bg-[#22252a] p-3 text-slate-200">
          <h3 className="mb-3 text-sm font-bold">{mode}</h3>
          {mode === "Editar" && (
            <div className="space-y-2">
              {[
                "Adicionar texto",
                "Adicionar imagem",
                "Criar link",
                "Cabeçalho e rodapé",
                "Marca d'água",
                "Plano de fundo",
                "OCR do documento",
              ].map((item) => (
                <button
                  key={item}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Comentar" && (
            <div className="grid grid-cols-2 gap-2">
              {[
                "Nota",
                "Realçar",
                "Sublinhar",
                "Riscar",
                "Desenhar",
                "Carimbo",
              ].map((item) => (
                <button
                  key={item}
                  className="rounded border border-slate-700 p-3 text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Organizar" && (
            <div className="space-y-2">
              {[
                "Inserir páginas",
                "Extrair",
                "Substituir",
                "Dividir",
                "Girar",
                "Excluir",
              ].map((item) => (
                <button
                  key={item}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Preencher e assinar" && (
            <div className="space-y-2">
              <button className="w-full rounded border border-slate-700 p-2 text-xs">
                Adicionar assinatura
              </button>
              <button className="w-full rounded border border-slate-700 p-2 text-xs">
                Adicionar iniciais
              </button>
              <button className="w-full rounded border border-slate-700 p-2 text-xs">
                Solicitar assinaturas
              </button>
            </div>
          )}
          {mode === "Proteger" && (
            <div className="space-y-2">
              {[
                "Criptografar com senha",
                "Restringir edição",
                "Remover informações ocultas",
                "Sanitizar documento",
                "Certificados",
              ].map((item) => (
                <button
                  key={item}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Exportar" && (
            <div className="space-y-2">
              {[
                "Microsoft Word",
                "Excel",
                "PowerPoint",
                "Imagem",
                "PDF/A",
                "PDF/X",
              ].map((item) => (
                <button
                  key={item}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 rounded border border-slate-700 p-3 text-[10px] text-slate-500">
            <CheckCircle2 size={14} className="mb-1 text-emerald-400" />
            Documento local · nenhuma alteração enviada ao sistema
          </div>
        </aside>
      </div>
    </section>
  );
}
