import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Camera,
  Clapperboard,
  FileText,
  FileType2,
  Frame,
  Image,
  Layers3,
  LayoutTemplate,
  Library,
  AudioLines,
  FileSpreadsheet,
  Orbit,
  PenTool,
  Presentation,
} from "lucide-react";
import CraftLibraryWorkspace from "../components/graphic-tools/CraftLibraryWorkspace";
import DesignCraftWorkspace from "../components/graphic-tools/DesignCraftWorkspace";
import EffectCraftWorkspace from "../components/graphic-tools/EffectCraftWorkspace";
import FilmCraftWorkspace from "../components/graphic-tools/FilmCraftWorkspace";
import FigCraftWorkspace from "../components/graphic-tools/FigCraftWorkspace";
import PhotoCraftWorkspace from "../components/graphic-tools/PhotoCraftWorkspace";
import {
  LightCraftWorkspace,
  PdfCraftWorkspace,
} from "../components/graphic-tools/RemainingCraftWorkspaces";
import VectorCraftWorkspace from "../components/graphic-tools/VectorCraftWorkspace";
import ThreeDCraftWorkspace from "../components/graphic-tools/ThreeDCraftWorkspace";
import SoundCraft from "./SoundCraft";
import OfficeCraft from "./OfficeCraft";
import { GraphicDraftProvider, useGraphicDraftState } from "../lib/graphicDrafts";
import { useEmpresa } from "../lib/empresaContext";
import { useAuth } from "../auth";

const tools = [
  {
    id: "filmcraft",
    label: "MMFilm",
    icon: Clapperboard,
    subtitle: "Premiere · edição",
    accept: "video/*,audio/*,image/*",
    panels: [
      "Monitores e edição de três pontos",
      "Trim, slip, slide e ripple",
      "Cor, scopes, efeitos e keyframes",
      "Mixer, loudness e exportação",
    ],
  },
  {
    id: "effectcraft",
    label: "MMEffects",
    icon: Layers3,
    subtitle: "After Effects · motion",
    accept: "video/*,image/*,audio/*",
    panels: [
      "Composições e camadas 2D/3D",
      "Keyframes e editor de gráficos",
      "259 efeitos e expressões",
      "Câmeras, luzes e fila de render",
    ],
  },
  {
    id: "vectorcraft",
    label: "MMVector",
    icon: PenTool,
    subtitle: "Illustrator · vetores",
    accept: "image/svg+xml,.svg,image/*",
    panels: [
      "Caneta e seleção direta",
      "Pathfinder e formas booleanas",
      "Malha, repetições e aparência",
      "Vetorização e exportação SVG/PDF",
    ],
  },
  {
    id: "photocraft",
    label: "MMPhoto",
    icon: Image,
    subtitle: "Photoshop · imagens",
    accept: "image/*,.psd",
    panels: [
      "Camadas, máscaras e estilos",
      "16 ajustes não destrutivos",
      "70+ filtros e objetos inteligentes",
      "PSD/PSB e gestão de cor",
    ],
  },
  {
    id: "lightcraft",
    label: "MMLight",
    icon: Camera,
    subtitle: "Revelação e catálogo",
    accept: "image/*,.dng,.raw,.cr2,.nef,.arw",
    panels: [
      "Catálogo, álbuns, notas e busca",
      "RAW não destrutivo em 32-bit",
      "Cor, curvas e color grading",
      "Máscaras, presets e exportação",
    ],
  },
  {
    id: "pdfcraft",
    label: "MMPDF",
    icon: FileText,
    subtitle: "Documentos PDF",
    accept: "application/pdf,.pdf",
    panels: [
      "Leitura, busca e seleção de texto",
      "Organizar, combinar e dividir",
      "Comentários, formulários e anexos",
      "Segurança, assinatura e recuperação",
    ],
  },
  {
    id: "designcraft",
    label: "MMDesign",
    icon: LayoutTemplate,
    subtitle: "Diagramação editorial",
    accept: "image/*,.svg,.pdf,.txt,.md",
    panels: [
      "Páginas espelhadas e páginas-mestre",
      "Quadros e matérias encadeadas",
      "Estilos, amostras e contorno de texto",
      "PDF para impressão, CMYK e sangria",
    ],
  },
  {
    id: "figcraft",
    label: "MMFig",
    icon: Frame,
    subtitle: "Figma · interface",
    accept: ".json,application/json",
    panels: [
      "Frames, componentes e instâncias",
      "Auto layout e restrições",
      "Protótipo com navegação",
      "Exportação PNG/SVG",
    ],
  },
  {
    id: "threecraft",
    label: "MM3D",
    icon: Orbit,
    subtitle: "Cena e objetos 3D",
    accept: "image/*,.glb,.gltf,.obj,.fbx,.hdr",
    panels: ["Viewport e grade 3D", "Outliner e propriedades", "Mover, rotacionar e escalar", "Mundo, câmera e timeline"],
  },
  {
    id: "craft-libs",
    label: "MMLibs",
    icon: Library,
    subtitle: "Motores compartilhados",
    accept: "image/*,video/*,audio/*,.svg,.pdf",
    panels: [
      "Codecs e formatos comuns",
      "Renderização e gestão de cor",
      "Automação por comandos",
      "Componentes usados pelos editores",
    ],
  },
  {
    id: "mmsom",
    label: "MMSom",
    icon: AudioLines,
    subtitle: "Áudio · edição e mixagem",
    accept: "audio/*",
    panels: ["Edição multipista", "Mesa de mixagem", "Limpeza de voz", "Masterização"],
  },
  { id: "word", label: "Word", icon: FileType2, subtitle: "Documentos e textos", accept: ".doc,.docx,.txt", panels: ["Documento", "Revisão", "Estrutura", "Exportação"] },
  { id: "excel", label: "Excel", icon: FileSpreadsheet, subtitle: "Planilhas e dados", accept: ".xls,.xlsx,.csv", panels: ["Planilha", "Fórmulas", "Dados", "Exportação"] },
  { id: "powerpoint", label: "PowerPoint", icon: Presentation, subtitle: "Apresentações e slides", accept: ".ppt,.pptx", panels: ["Slides", "Layout", "Apresentação", "Exportação"] },
];

export default function GraphicTools() {
  const { currentEmpresa } = useEmpresa();
  const { user } = useAuth();
  const scope = `${currentEmpresa?.id || "global"}:${user?.id || "anonymous"}`;
  return <GraphicDraftProvider key={scope} scope={scope}><GraphicToolsRoute /></GraphicDraftProvider>;
}

function GraphicToolsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTool = new URLSearchParams(location.search).get("tool");

  return <GraphicToolsContent
    requestedTool={requestedTool}
    onChoose={(id) => navigate(`/ferramentas-graficas?tool=${id}`)}
  />;
}

export function GraphicToolsContent({ requestedTool, onChoose }) {
  const requested = requestedTool ?? new URLSearchParams(window.location.search).get("tool");
  const initial = tools.some((tool) => tool.id === requested)
    ? requested
    : "filmcraft";
  const routeActive = requestedTool && tools.some((tool) => tool.id === requestedTool)
    ? requestedTool
    : null;
  const [localActive, setLocalActive] = useState(initial);
  const active = routeActive || localActive;
  const [assets, setAssets] = useGraphicDraftState("shared:assets", []);
  const [selected, setSelected] = useGraphicDraftState("shared:selected", null);
  const [visited, setVisited] = useState([initial]);
  const urls = useRef(new Set());
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    if (routeActive) setVisited((current) => current.includes(routeActive) ? current : [...current, routeActive]);
  }, [routeActive]);

  function openFiles(fileList) {
    const next = [...fileList].map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type:
          file.type ||
          (file.name.endsWith(".pdf")
            ? "application/pdf"
            : "application/octet-stream"),
        url,
      };
    });
    setAssets((current) => [...current, ...next]);
    if (next[0]) setSelected(next[0]);
  }
  function choose(id) {
    setVisited(current => current.includes(id) ? current : [...current, id]);
    setLocalActive(id);
    if (onChoose) {
      onChoose(id);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tool", id);
    window.history.replaceState({}, "", url);
  }

  return (
    <section className="space-y-4">
      <header className="border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-black text-white">Ferramentas Gráficas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pacote criativo isolado do MediaMind, preparado para integração
          futura.
        </p>
      </header>
      <nav
        role="tablist"
        aria-label="Programas das Ferramentas Gráficas"
        className="flex h-9 overflow-x-auto border border-slate-800 bg-[#191919] p-0.5 rounded-none"
      >
        {tools.map((item) => {
          const TabIcon = item.icon;
          return (
            <button
              role="tab"
              aria-selected={active === item.id}
              key={item.id}
              onClick={() => choose(item.id)}
              className={`flex-1 px-3 text-left ${active === item.id ? "border-b-2 border-blue-500 bg-[#242424] text-white" : "text-slate-500 hover:bg-[#242424]"} min-w-24 py-1`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <TabIcon size={16} />
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      {visited.map(id => <div key={id} hidden={active !== id}>
      {id === "filmcraft" ? (
        <FilmCraftWorkspace active={active === id} />
      ) : id === "effectcraft" ? (
        <EffectCraftWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "vectorcraft" ? (
        <VectorCraftWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "photocraft" ? (
        <PhotoCraftWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "lightcraft" ? (
        <LightCraftWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "pdfcraft" ? (
        <PdfCraftWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "designcraft" ? (
        <DesignCraftWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "figcraft" ? (
        <FigCraftWorkspace active={active === id} />
      ) : id === "threecraft" ? (
        <ThreeDCraftWorkspace active={active === id} />
      ) : id === "craft-libs" ? (
        <CraftLibraryWorkspace
          active={active === id}
          assets={assets}
          selected={selected}
          onSelect={setSelected}
          onOpenFiles={openFiles}
        />
      ) : id === "mmsom" ? (
        <SoundCraft active={active === id} />
      ) : ["word", "excel", "powerpoint"].includes(id) ? (
        <OfficeCraft active={active === id} initialApp={id === "word" ? "Word" : id === "excel" ? "Excel" : "PowerPoint"} showAppSwitcher={false} />
      ) : (
        <FilmCraftWorkspace />
      )}
      </div>)}
    </section>
  );
}
