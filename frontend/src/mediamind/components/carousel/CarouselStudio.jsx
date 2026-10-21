import { useWorkDraftState, useWorkDraftExists } from "../../lib/workProtection";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Save,
  Download,
  Copy,
  ArrowLeft,
  ArrowRight,
  Trash2,
  BookOpen,
  X,
} from "lucide-react";
import {
  createCarouselDocument,
  parseCarouselImport,
  validateCarouselDocument,
} from "../../lib/carouselDocument";
import {
  listCreativeDocuments,
  createCreativeDocument,
  updateCreativeDocument,
  approveCreativeDocument,
} from "../../lib/creativeToolsApi";
import { buildCarouselZip } from "../../lib/carouselExport";
import {
  SOCIAL_FORMATS,
  socialFormatLabel,
} from "../../lib/socialFormats";
import { useProducaoProjetos } from "../../lib/producaoStore";
import CarouselSlideCanvas from "./CarouselSlideCanvas";
import {
  Button,
  Panel,
  Field,
  Notice,
  inputClass,
  downloadBlob,
  readImage,
} from "../ai-tools/StudioUI";
const steps = ["Meu perfil", "Ideias", "Copy", "Editor", "Projetos"];
const templates = [
  ["single-news", "SIMERS · Notícia individual", "#62d7c4"],
  ["giro", "SIMERS · Giro da Semana", "#00bd78"],
  ["health", "Saúde SIMERS · ondas", "#008b8b"],
  ["night", "Essencial", "#38bdf8"],
  ["violet", "Criativo", "#a78bfa"],
  ["paper", "Editorial", "#e7dfcf"],
  ["coral", "Impacto", "#fb7185"],
  ["forest", "Natural", "#6ee7b7"],
  ["blue", "Institucional", "#60a5fa"],
];
const slide = (title, body, type = "content") => ({
  id: crypto.randomUUID(),
  title,
  body,
  type,
  badge: "",
  action: "",
  image: null,
  titleSize: 48,
  bodySize: 18,
  textAlign: "left",
  lineHeight: 1.05,
  letterSpacing: 0,
  duration: 4,
  mediaType: "image",
  video: null,
});
const readMedia = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Escolha uma mídia."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a mídia."));
    reader.readAsDataURL(file);
  });
const defaultDocument = (project) => ({
  ...createCarouselDocument({ project }),
  title: "Saúde mental merece atenção",
  slides: [
    slide("Saúde mental merece atenção", "Cuidar da mente também é cuidar da sua vida.", "cover"),
    slide("Por que é tão importante?", "Informação e prevenção ajudam a reconhecer mudanças e buscar apoio."),
    slide("Reconheça os sinais", "Sono alterado, cansaço persistente e dificuldade de concentração merecem atenção."),
    slide("Quando buscar ajuda", "Procure apoio quando os sinais persistirem ou afetarem sua rotina."),
    slide("Cuidados no dia a dia", "Sono, atividade física, vínculos e acompanhamento profissional fazem diferença."),
    slide("Você não está sozinho", "Compartilhe informação responsável e incentive o cuidado.", "cta"),
  ],
});
const blankDocument = () => ({
  ...createCarouselDocument(),
  title: "",
  format: "4:5",
  template_id: "",
  requested_slide_count: 1,
  slides: [slide("", "", "content")],
});
const defaultLayers = () => [
  { id: "identity", label: "Identidade", visible: true, locked: true },
  { id: "title", label: "Título", visible: true, locked: false },
  { id: "body", label: "Texto", visible: true, locked: false },
  { id: "media", label: "Imagem / vídeo", visible: true, locked: false },
  { id: "footer", label: "Rodapé", visible: true, locked: false },
];
const singleArtPresets = [
  { name: "Lima institucional", image: 1, backgroundColor: "#e3ff91", textColor: "#073b3b", highlightColor: "#073b3b", highlightTextColor: "#e3ff91" },
  { name: "Turquesa institucional", image: 2, backgroundColor: "#62d7c4", textColor: "#071b45", highlightColor: "#071b45", highlightTextColor: "#62d7c4" },
  { name: "Lima escuro", image: 3, backgroundColor: "#063b36", textColor: "#e3ff91", highlightColor: "#e3ff91", highlightTextColor: "#063b36" },
  { name: "Verde profundo", image: 5, backgroundColor: "#00483f", textColor: "#00bd78", highlightColor: "#00bd78", highlightTextColor: "#00483f" },
  { name: "Verde notícia", image: 6, backgroundColor: "#063b36", textColor: "#ddff86", highlightColor: "#ddff86", highlightTextColor: "#063b36" },
];
export default function CarouselStudio({ projectId = null, initialMode = "image", initialTemplate = "", embedded = false }) {
  const projects = useProducaoProjetos();
  const initialDoc = useRef(defaultDocument(projects.find((p) => String(p.id) === String(projectId))));
  const recoveredDocument = useRef(useWorkDraftExists("components/carousel/CarouselStudio.jsx:doc"));
  const [doc, setDoc] = useWorkDraftState("components/carousel/CarouselStudio.jsx:doc", initialDoc.current);
  const [step, setStep] = useWorkDraftState("components/carousel/CarouselStudio.jsx:step", 0),
    [profile, setProfile] = useWorkDraftState("components/carousel/CarouselStudio.jsx:profile", {
      name: "MediaMind",
      handle: "@mediamind",
      niche: "Conteúdo e comunicação",
      audience: "Profissionais e empreendedores",
      tone: "Direto e educativo",
    }),
    [topic, setTopic] = useWorkDraftState("components/carousel/CarouselStudio.jsx:topic",
      "Como transformar uma ideia em conteúdo que gera conexão",
    ),
    [theme, setTheme] = useWorkDraftState("components/carousel/CarouselStudio.jsx:theme", initialMode === "single" ? "single-news" : "health"),
    [selected, setSelected] = useWorkDraftState("components/carousel/CarouselStudio.jsx:selected", 0),
    [raw, setRaw] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [rightPanel, setRightPanel] = useState("properties"),
    [guideOpen, setGuideOpen] = useState(false),
    [modesOpen, setModesOpen] = useState(true),
    [artSection, setArtSection] = useWorkDraftState("components/carousel/CarouselStudio.jsx:artSection", "simers"),
    [contentMode, setContentMode] = useWorkDraftState("components/carousel/CarouselStudio.jsx:contentMode", initialMode),
    [exportMode, setExportMode] = useState("individual"),
    [selectedFormats, setSelectedFormats] = useWorkDraftState("components/carousel/CarouselStudio.jsx:selectedFormats", ["4:5"]),
    [customFormatOpen, setCustomFormatOpen] = useState(false),
    [customFormat, setCustomFormat] = useWorkDraftState("components/carousel/CarouselStudio.jsx:customFormat", { name: "Personalizado", width: 1080, height: 1080 }),
    [customFormats, setCustomFormats] = useWorkDraftState("components/carousel/CarouselStudio.jsx:customFormats", () => {
      try { return JSON.parse(localStorage.getItem("mm-custom-social-formats") || "[]"); } catch { return []; }
    }),
    [layers, setLayers] = useWorkDraftState("components/carousel/CarouselStudio.jsx:layers", defaultLayers),
    [templatesSaved, setTemplatesSaved] = useWorkDraftState("components/carousel/CarouselStudio.jsx:templatesSaved", () => {
      try { return JSON.parse(localStorage.getItem("mm-carousel-templates") || "[]"); } catch { return []; }
    }),
    [activeTemplate, setActiveTemplate] = useWorkDraftState("components/carousel/CarouselStudio.jsx:activeTemplate", ""),
    [workspaces, setWorkspaces] = useWorkDraftState("components/carousel/CarouselStudio.jsx:workspaces", () => [
      { id: crypto.randomUUID(), name: "Arte 1", snapshot: null },
      { id: crypto.randomUUID(), name: "Arte 2", snapshot: { doc: defaultDocument(), profile: { name: "MediaMind", handle: "@mediamind", niche: "Conteúdo e comunicação", audience: "Profissionais e empreendedores", tone: "Direto e educativo" }, theme: "health", contentMode: "image", selectedFormats: ["4:5"], layers: defaultLayers() } },
    ]),
    [activeWorkspace, setActiveWorkspace] = useWorkDraftState("components/carousel/CarouselStudio.jsx:activeWorkspace", null),
    [drafts, setDrafts] = useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(`mm-carousel:${projectId || "local"}`) || "[]",
        );
      } catch {
        return [];
      }
    });
  const [remote, setRemote] = useState([]);
  const actualWorkspace = activeWorkspace || workspaces[0].id;
  const formatOptions = [...SOCIAL_FORMATS, ...customFormats];
  const [record, setRecord] = useState(null);
  const [creationMode, setCreationMode] = useWorkDraftState("components/carousel/CarouselStudio.jsx:creationMode", "patterns");
  const [workspaceMode, setWorkspaceMode] = useWorkDraftState("components/carousel/CarouselStudio.jsx:workspaceMode", "simers");
  const [patterns, setPatterns] = useWorkDraftState("components/carousel/CarouselStudio.jsx:patterns", () => {
    try {
      return (
        JSON.parse(localStorage.getItem("mm-carousel-patterns") || "null") || [
          {
            id: "simers-onda",
            name: "SIMERS · Onda institucional",
            theme: "forest",
          },
        ]
      );
    } catch {
      return [
        {
          id: "simers-onda",
          name: "SIMERS · Onda institucional",
          theme: "forest",
        },
      ];
    }
  });
  const [activePattern, setActivePattern] = useWorkDraftState("components/carousel/CarouselStudio.jsx:activePattern", "simers-onda");
  const exportsRef = useRef(null);
  async function loadRemote() {
    try {
      const items = await listCreativeDocuments("carousel");
      setRemote(
        (items || []).filter(
          (item) =>
            !projectId ||
            String(item.content?.project_id) === String(projectId),
        ),
      );
      setMessage("Projetos compartilhados carregados. Escolha um para abrir.");
    } catch (e) {
      setMessage(
        e.message ||
          "Não foi possível carregar os projetos compartilhados. Seus rascunhos locais continuam disponíveis.",
      );
    }
  }
  async function sync() {
    setBusy(true);
    try {
      const content = {
        ...doc,
        profile,
        theme,
        project_id: projectId ? String(projectId) : doc.project_id,
      };
      const result =
        record && record.content?.id === doc.id
          ? await updateCreativeDocument(record.id, { content })
          : await createCreativeDocument({ tool_type: "carousel", content });
      setRecord(result);
      setMessage(`Salvo no MediaMind · revisão ${result.revision}.`);
    } catch (e) {
      setMessage(
        e.message ||
          "Não foi possível sincronizar. Você pode salvar neste navegador.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (
      !record ||
      JSON.stringify(record.content) !==
        JSON.stringify({
          ...doc,
          profile,
          theme,
          project_id: projectId ? String(projectId) : doc.project_id,
        })
    ) {
      setMessage("Salve a versão atual no MediaMind antes de aprovar.");
      return;
    }
    try {
      const result = await approveCreativeDocument(record.id);
      setRecord(result);
      setMessage(`Revisão ${result.revision} aprovada.`);
    } catch (e) {
      setMessage(e.message || "Não foi possível aprovar a revisão.");
    }
  }
  const patch = (k, v) => setDoc((d) => ({ ...d, [k]: v }));
  const current = doc.slides[selected];
  const patchSlide = (k, v) =>
    setDoc((d) => ({
      ...d,
      slides: d.slides.map((s, i) => (i === selected ? { ...s, [k]: v } : s)),
    }));
  const snapshot = () => ({ doc, profile, theme, contentMode, selectedFormats, layers });
  function loadSnapshot(value) {
    setDoc(value.doc); setProfile(value.profile); setTheme(value.theme);
    setContentMode(value.contentMode || "image"); setSelectedFormats(value.selectedFormats || [value.doc.format || "4:5"]);
    setLayers(value.layers || defaultLayers()); setSelected(0); setStep(3);
  }
  function switchWorkspace(id) {
    if (id === actualWorkspace) return;
    const target = workspaces.find((item) => item.id === id);
    setWorkspaces((items) => items.map((item) => item.id === actualWorkspace ? { ...item, snapshot: snapshot() } : item));
    if (target?.snapshot) loadSnapshot(target.snapshot);
    setActiveWorkspace(id);
  }
  function newWorkspace() {
    const id = crypto.randomUUID();
    const fresh = { doc: blankDocument(), profile: { ...profile }, theme: "single-news", contentMode: "single", selectedFormats: ["4:5"], layers: defaultLayers() };
    setWorkspaces((items) => [...items.map((item) => item.id === actualWorkspace ? { ...item, snapshot: snapshot() } : item), { id, name: `Arte ${items.length + 1}`, snapshot: fresh }]);
    loadSnapshot(fresh); setActiveWorkspace(id); setMessage("Nova arte aberta. As anteriores continuam disponíveis nas outras abas.");
  }
  function deleteWorkspace(id) {
    const target = workspaces.find((item) => item.id === id);
    if (!target || !window.confirm(`Excluir ${target.name}? Esta ação remove a arte aberta e não pode ser desfeita.`)) return;
    const index = workspaces.findIndex((item) => item.id === id);
    const remaining = workspaces.filter((item) => item.id !== id);
    if (!remaining.length) {
      const replacement = { id: crypto.randomUUID(), name: "Arte 1", snapshot: { doc: blankDocument(), profile: { ...profile }, theme: "single-news", contentMode: "single", selectedFormats: ["4:5"], layers: defaultLayers() } };
      setWorkspaces([replacement]); loadSnapshot(replacement.snapshot); setActiveWorkspace(replacement.id);
    } else {
      setWorkspaces(remaining);
      if (id === actualWorkspace) {
        const next = remaining[Math.min(index, remaining.length - 1)];
        loadSnapshot(next.snapshot); setActiveWorkspace(next.id);
      }
    }
    setMessage(`${target.name} excluída.`);
  }
  function saveTemplate() {
    const item = { id: crypto.randomUUID(), name: doc.title || "Modelo sem título", snapshot: snapshot() };
    const next = [item, ...templatesSaved];
    localStorage.setItem("mm-carousel-templates", JSON.stringify(next));
    setTemplatesSaved(next); setActiveTemplate(item.id); setMessage("Modelo salvo e disponível para novos carrosséis.");
  }
  function addCustomFormat(saveAsPreset) {
    const width = Number(customFormat.width);
    const height = Number(customFormat.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 100 || height < 100) {
      setMessage("Informe largura e altura válidas, com pelo menos 100 pixels."); return;
    }
    const item = { ...customFormat, name: customFormat.name.trim() || "Personalizado", width, height };
    item.id = `custom:${encodeURIComponent(item.name)}:${width}x${height}`;
    if (saveAsPreset) {
      const next = [item, ...customFormats.filter((format) => format.id !== item.id)];
      setCustomFormats(next); localStorage.setItem("mm-custom-social-formats", JSON.stringify(next));
    }
    setSelectedFormats((items) => items.includes(item.id) ? items : [...items, item.id]);
    setCustomFormatOpen(false);
    setMessage(saveAsPreset ? "Formato personalizado adicionado e fixado nas opções." : "Formato personalizado adicionado a este carrossel.");
  }
  function applyGiroTemplate() {
    setTheme("giro");
    setProfile((value) => ({ ...value, name: "SIMERS", handle: "Defender os médicos é defender a saúde.", fontFamily: "Arial, sans-serif" }));
    setDoc((value) => ({
      ...value,
      title: "Giro de Notícias da Semana",
      format: "4:5",
      template_id: "simers-giro-semana",
      requested_slide_count: 5,
      slides: [
        { ...slide("GIRO DE NOTÍCIAS DA SEMANA", "03 A 09 DE OUTUBRO", "cover"), badge: "GIRO DA SEMANA" },
        { ...slide("SIMERS ACOMPANHA MUDANÇAS EM UNIDADES DE SAÚDE DE CACHOEIRINHA", "Sindicato dialogou com médicos e acompanha as condições de atendimento e contratação dos profissionais."), badge: "GIRO DE NOTÍCIAS DA SEMANA" },
        { ...slide("DESTAQUES DA SEMANA", "Edite este texto com a próxima notícia e adicione a imagem correspondente."), badge: "GIRO DE NOTÍCIAS DA SEMANA" },
        { ...slide("ATUAÇÃO DO SIMERS", "Use esta página para apresentar outra ação ou atualização relevante da semana."), badge: "GIRO DE NOTÍCIAS DA SEMANA" },
        { ...slide("ACOMPANHE O SIMERS", "Siga os canais oficiais para receber as próximas notícias.", "cta"), badge: "GIRO DE NOTÍCIAS DA SEMANA" },
      ],
    }));
    setSelectedFormats((items) => items.includes("4:5") ? items : ["4:5", ...items]);
    setSelected(0); setStep(3); setMessage("Modelo Giro da Semana aplicado. Edite período, notícias e imagens de cada página.");
  }
  function applyHealthTemplate() {
    setTheme("health");
    setContentMode("image");
    setProfile((value) => ({ ...value, name: "SIMERS", handle: "Defender os médicos é defender a saúde.", fontFamily: "Arial, sans-serif" }));
    setDoc((value) => ({
      ...defaultDocument(),
      id: value.id,
      project_id: value.project_id,
      title: "Saúde mental merece atenção",
      format: "4:5",
      template_id: "simers-saude-ondas",
    }));
    setSelectedFormats((items) => items.includes("4:5") ? items : ["4:5", ...items]);
    setSelected(0); setStep(3); setMessage("Modelo Saúde em ondas aplicado. Edite os textos, imagens e páginas do trabalho.");
  }
  function applySingleArtTemplate() {
    const first = {
      ...slide("Simers se reúne com diretoria do Hospital Estrela para tratar do atendimento psiquiátrico", "", "content"),
      highlightText: "Hospital Estrela",
      backgroundColor: "#62d7c4",
      textColor: "#032f39",
      highlightColor: "#071b45",
      highlightTextColor: "#62d7c4",
      imagePosition: "top",
      imageRatio: 48,
    };
    setContentMode("single"); setTheme("single-news");
    setProfile((value) => ({ ...value, name: "SIMERS", handle: "" }));
    setDoc((value) => ({ ...value, title: "Arte única SIMERS", format: "4:5", template_id: "simers-noticia-unica", requested_slide_count: 1, slides: [first] }));
    setSelected(0); setStep(3); setMessage("");
  }
  const initialTemplateApplied = useRef(false);
  useEffect(() => {
    if (recoveredDocument.current || initialTemplateApplied.current || !initialTemplate) return;
    initialTemplateApplied.current = true;
    if (initialTemplate === "giro") applyGiroTemplate();
    if (initialTemplate === "health") applyHealthTemplate();
  }, [initialTemplate]);
  function applySinglePreset(preset) {
    setDoc((value) => ({ ...value, slides: value.slides.map((item, index) => index === selected ? { ...item, ...preset } : item) }));
    setMessage(`Padrão ${preset.name} aplicado à arte atual.`);
  }
  function applySingleArtModel(preset) {
    setContentMode("single"); setTheme("single-news");
    setDoc((value) => ({ ...value, template_id: "simers-noticia-unica", slides: value.slides.map((item, index) => index === selected ? { ...item, ...preset } : item) }));
    setProfile((value) => ({ ...value, name: "SIMERS", handle: "" }));
    setMessage("");
  }
  useEffect(() => {
    if (!recoveredDocument.current && initialMode === "single" && !initialTemplate) applySingleArtTemplate();
  }, []);
  function example() {
    setDoc((d) => ({
      ...d,
      title: topic,
      slides: [
        slide(
          topic,
          "Um guia prático para tirar suas ideias do papel.",
          "cover",
        ),
        slide(
          "Comece por uma pergunta",
          "Qual dúvida seu público precisa resolver hoje? Foque em uma mensagem por publicação.",
        ),
        slide(
          "Dê contexto antes da solução",
          "Mostre a situação, explique por que ela importa e apresente uma ação simples.",
        ),
        slide(
          "Transforme informação em ação",
          "Use exemplos concretos e organize o conteúdo em passos curtos.",
        ),
        slide(
          "Revise antes de publicar",
          "Confira fatos, clareza e contraste. Uma boa edição valoriza a mensagem.",
        ),
        slide(
          "Sua próxima ideia começa agora",
          "Salve este guia e compartilhe com quem cria conteúdo.",
          "cta",
        ),
      ],
      caption:
        "Ideias claras merecem uma apresentação à altura. Qual será seu próximo conteúdo?",
      hashtags: ["#conteudo", "#comunicacao"],
    }));
    setSelected(0);
    setStep(2);
    setMessage(
      "Exemplo editorial carregado para demonstração. Revise e adapte ao seu público.",
    );
  }
  function save() {
    try {
      const entry = {
        ...doc,
        profile,
        theme,
        updated_at: new Date().toISOString(),
      };
      const items = [entry, ...drafts.filter((d) => d.id !== doc.id)].slice(
        0,
        12,
      );
      localStorage.setItem(
        `mm-carousel:${projectId || "local"}`,
        JSON.stringify(items),
      );
      setDrafts(items);
      setMessage(
        "Projeto salvo neste navegador. Exporte o ZIP para guardar uma cópia.",
      );
    } catch {
      setMessage(
        "Armazenamento local cheio. Exporte o ZIP para guardar o projeto.",
      );
    }
  }
  async function exportZip() {
    if (!doc.slides.length) {
      setMessage("Adicione slides antes de exportar.");
      return;
    }
    setBusy(true);
    try {
      await document.fonts?.ready;
      const elements = [
        ...exportsRef.current.querySelectorAll("[data-carousel-slide]"),
      ];
      downloadBlob(
        await buildCarouselZip({ ...doc, profile, theme }, elements),
        exportMode === "sequence" ? "mediamind-sequencia.zip" : "mediamind-artes.zip",
      );
      setMessage(
        `${exportMode === "sequence" ? "Sequência" : "Artes individuais"} exportada em ${socialFormatLabel(doc.format)}.`,
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  function importJSON() {
    try {
      const clean = raw
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
      const parsed = JSON.parse(clean);
      if (parsed.tool_type === "carousel" && Array.isArray(parsed.slides)) {
        const errors = validateCarouselDocument(parsed);
        if (errors.length) throw new Error(errors[0].message);
        setDoc({ ...createCarouselDocument(), ...parsed });
        setProfile(parsed.profile || profile);
        setTheme(parsed.theme || theme);
      } else {
        const result = parseCarouselImport(clean, doc);
        setDoc(result.document);
      }
      setSelected(0);
      setStep(3);
      setMessage("Texto importado. Revise os slides no editor.");
    } catch (e) {
      setMessage(e.message);
    }
  }
  const prompt = `Crie um carrossel sobre "${topic}" para ${profile.audience}. Tom: ${profile.tone}. Retorne JSON com tema, slides [{tipo: capa|conteudo|cta, titulo, texto}], legenda e hashtags. Use frases curtas e fatos verificáveis.`;
  return (
    <section className="min-h-[calc(100vh-150px)] bg-mm-studio">
      {!embedded && <><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          {!embedded && <h2 className="text-2xl font-black text-white">Estúdio de Carrosséis</h2>}
        </div>
        <div role="tablist" aria-label="Artes abertas" className="flex min-w-[260px] flex-1 gap-2 overflow-x-auto">
          {workspaces.map((workspace) => <div key={workspace.id} className="relative shrink-0"><button role="tab" aria-selected={workspace.id === actualWorkspace} type="button" onClick={() => switchWorkspace(workspace.id)} className={`rounded-lg border py-2 pl-4 pr-9 text-xs font-bold ${workspace.id === actualWorkspace ? "border-cyan-400 bg-cyan-950 text-cyan-200" : "border-slate-700 text-slate-400"}`}>{workspace.name}</button><button type="button" aria-label={`Excluir ${workspace.name}`} title={`Excluir ${workspace.name}`} onClick={() => deleteWorkspace(workspace.id)} className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-rose-950 hover:text-rose-300"><Trash2 size={12} /></button></div>)}
          <button type="button" aria-label="Adicionar outra arte" onClick={() => { setArtSection("simers"); newWorkspace(); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-dashed border-slate-600 text-cyan-300"><Plus size={16} /></button>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveTemplate}>Salvar como modelo</Button>
          <Button onClick={save}>
            <Save size={16} /> Salvar rascunho
          </Button>
        </div>
      </header>
      <div className="border-b border-slate-800 bg-mm-bar"><button type="button" aria-expanded={modesOpen} onClick={() => setModesOpen((value) => !value)} className="flex w-full items-center justify-between px-5 py-2 text-xs font-bold text-slate-300"><span>Modo: {[["simers","Padrão SIMERS"],["free","Criação Livre"],["reference","Usar Referência"],["models","Meus modelos"],["others","Outros"]].find(([id]) => id === artSection)?.[1]}</span><span>{modesOpen ? "Recolher ▴" : "Expandir ▾"}</span></button>{modesOpen && <div role="tablist" aria-label="Modos do Estúdio de Arte" className="grid sm:grid-cols-5">
        {[["simers","Padrão SIMERS"],["free","Criação Livre"],["reference","Usar Referência"],["models","Meus modelos"],["others","Outros"]].map(([id,label]) => <button key={id} role="tab" aria-selected={artSection === id} type="button" onClick={() => setArtSection(id)} className={`px-4 py-3 text-sm font-bold ${artSection === id ? "border-b-2 border-cyan-400 bg-cyan-950/40 text-cyan-200" : "text-slate-400"}`}>{label}</button>)}
      </div>}</div>
      {modesOpen && artSection === "simers" && <section role="region" aria-label="Modelos SIMERS" className="border-b border-slate-800 bg-mm-bar px-4 py-3">
        <div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-black text-white">Modelos SIMERS</h3><p className="text-[11px] text-slate-400">Clique em uma miniatura para aplicar à arte selecionada.</p></div></div>
        <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">Artes individuais</h4>
        <div className="flex flex-wrap gap-3 pb-2">
          {singleArtPresets.map((preset) => <button key={`${preset.name}-model`} type="button" aria-label={`Usar modelo ${preset.name}`} onClick={() => applySingleArtModel(preset)} className="w-24 shrink-0 rounded-xl border border-slate-700 bg-slate-950/60 p-1 text-left hover:border-cyan-400">
            <img src={`/reference/arte-unica-${preset.image}.png`} alt="" className="aspect-[4/5] w-full rounded-lg object-cover object-top" />
            <span className="mt-1 block truncate px-1 text-[10px] font-bold text-slate-200">{preset.name}</span>
          </button>)}
        </div>
        <div className="mt-3 border-t border-slate-700/70 pt-3">
          <h4 className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300">Carrosséis</h4>
          <div className="flex flex-wrap gap-3 pb-1">
          <button type="button" aria-label="Usar modelo Giro da Semana" onClick={applyGiroTemplate} className="w-24 shrink-0 rounded-xl border border-slate-700 bg-slate-950/60 p-1 text-left hover:border-cyan-400"><img src="/reference/giro-semana-capa.png" alt="" className="aspect-[4/5] w-full rounded-lg object-cover object-top" /><span className="mt-1 block truncate px-1 text-[10px] font-bold text-slate-200">Giro da Semana</span></button>
          <button type="button" aria-label="Usar modelo Saúde em ondas" onClick={applyHealthTemplate} className="w-24 shrink-0 rounded-xl border border-slate-700 bg-slate-950/60 p-1 text-left hover:border-cyan-400"><img src="/reference/carousel-saude-capa.png" alt="" className="aspect-[4/5] w-full rounded-lg object-cover object-top" /><span className="mt-1 block truncate px-1 text-[10px] font-bold text-slate-200">Saúde em ondas</span></button>
          </div>
        </div>
      </section>}
      {modesOpen && artSection === "reference" && <div className="border-b border-slate-800 bg-mm-bar px-5 py-3 text-sm text-slate-300"><strong>Usar Referência</strong><span className="ml-2 text-slate-500">Selecione uma referência no painel lateral ou envie uma imagem em “+ Mídia”.</span></div>}
      {modesOpen && artSection === "free" && <div className="border-b border-slate-800 bg-mm-bar px-5 py-3 text-sm text-slate-300"><strong>Criação Livre</strong><span className="ml-2 text-slate-500">Cores, textos, fotos, formatos e camadas ficam totalmente editáveis.</span></div>}
      {modesOpen && artSection === "models" && <section aria-label="Meus modelos salvos" className="border-b border-slate-800 bg-mm-bar px-5 py-4 text-sm text-slate-300"><strong className="block">Meus modelos</strong><span className="mt-1 block text-xs text-slate-500">As composições salvas ficam disponíveis aqui para reabrir e reutilizar.</span>{templatesSaved.length ? <div className="mt-3 flex gap-3 overflow-x-auto pb-1">{templatesSaved.map((template) => <button key={template.id} type="button" aria-label={`Abrir modelo ${template.name}`} onClick={() => { setActiveTemplate(template.id); loadSnapshot(template.snapshot); }} className={`min-w-44 rounded-xl border p-3 text-left ${activeTemplate === template.id ? "border-cyan-400 bg-cyan-950/40" : "border-slate-700 bg-slate-950/60 hover:border-slate-500"}`}><strong className="block truncate text-xs text-white">{template.name}</strong><small className="mt-1 block text-[10px] text-slate-500">Clique para abrir</small></button>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">Nenhum modelo salvo ainda.</p>}</section>}
      {modesOpen && artSection === "others" && <div className="border-b border-slate-800 bg-mm-bar px-5 py-3 text-sm text-slate-300"><strong>Outros</strong><span className="ml-2 text-slate-500">Identidades de outros clientes e canais poderão ser cadastradas aqui. Use Criação Livre enquanto não houver um modelo aprovado.</span></div>}</>}
      <div role="tablist" aria-label="Tipo de carrossel" className={`${workspaces.find((item) => item.id === actualWorkspace)?.collapsed || (embedded && initialMode === "single") ? "hidden" : "flex"} justify-center gap-1 border-b border-slate-800 bg-mm-bar px-4`}>
        <button role="tab" aria-selected={contentMode === "image"} type="button" onClick={() => setContentMode("image")} className={`border-b-2 px-7 py-3 text-sm font-bold ${contentMode === "image" ? "border-cyan-400 bg-sky-950/50 text-cyan-300" : "border-transparent text-slate-400"}`}>▧ Imagem</button>
        <button role="tab" aria-selected={contentMode === "video"} type="button" onClick={() => setContentMode("video")} className={`border-b-2 px-7 py-3 text-sm font-bold ${contentMode === "video" ? "border-cyan-400 bg-sky-950/50 text-cyan-300" : "border-transparent text-slate-400"}`}>▶ Vídeo</button>
        <button role="tab" aria-selected={contentMode === "mixed"} type="button" onClick={() => setContentMode("mixed")} className={`border-b-2 px-7 py-3 text-sm font-bold ${contentMode === "mixed" ? "border-cyan-400 bg-sky-950/50 text-cyan-300" : "border-transparent text-slate-400"}`}>◫ Mesclado</button>
        {!embedded && <button role="tab" aria-selected={contentMode === "single"} type="button" onClick={applySingleArtTemplate} className={`border-b-2 px-7 py-3 text-sm font-bold ${contentMode === "single" ? "border-cyan-400 bg-sky-950/50 text-cyan-300" : "border-transparent text-slate-400"}`}>▣ Arte única</button>}
      </div>
      <div className="hidden grid-cols-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70">
        {[
          ["ai", "Criar com IA", "Briefing, ideias, copy e revisão"],
          ["patterns", "Criar por padrões", "SIMERS e novos padrões do acervo"],
        ].map(([id, label, detail]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCreationMode(id)}
            className={`px-5 py-3 text-left ${creationMode === id ? "bg-sky-950/70 text-sky-200 ring-1 ring-inset ring-sky-400" : "text-slate-400 hover:bg-slate-900"}`}
          >
            <span className="block text-sm font-bold">{label}</span>
            <span className="mt-0.5 block text-xs opacity-70">{detail}</span>
          </button>
        ))}
      </div>
      {creationMode === "ai" && (
        <div
          className="grid grid-cols-5 gap-2"
          aria-label="Esteira de criação com IA"
        >
          {steps.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`rounded-xl border px-2 py-3 text-xs font-semibold ${step === i ? "border-sky-400 bg-sky-500/10 text-sky-200" : "border-slate-800 bg-slate-900 text-slate-500"}`}
            >
              <span className="mr-2 opacity-50">0{i + 1}</span>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="px-4 pt-3"><Notice>{message}</Notice></div>
      {false && creationMode === "patterns" && (
        <div
          role="tablist"
          aria-label="Modos do Estúdio de Carrosséis"
          className="grid overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70 sm:grid-cols-4"
        >
          {[
            ["simers", "Padrão SIMERS"],
            ["reference", "Usar referência"],
            ["free", "Criação livre"],
            ["models", "Meus modelos"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={workspaceMode === id}
              type="button"
              onClick={() => setWorkspaceMode(id)}
              className={`px-4 py-3 text-sm font-semibold ${workspaceMode === id ? "border-b-2 border-sky-400 bg-sky-950/60 text-sky-300" : "text-slate-400 hover:bg-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {false && creationMode === "patterns" && workspaceMode === "simers" && (
        <section
          aria-label="Guia Padrão SIMERS"
          className="rounded-2xl border border-emerald-700/50 bg-gradient-to-r from-emerald-950/50 to-slate-950 p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <h3 className="font-bold text-white">Guia Padrão SIMERS</h3>
              <p className="mt-1 text-xs text-slate-400">
                Identidades reutilizáveis e editáveis para diferentes formatos
                de carrossel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {patterns.map((pattern) => (
                <button
                  type="button"
                  key={pattern.id}
                  onClick={() => {
                    setActivePattern(pattern.id);
                    setTheme(pattern.theme);
                    setProfile((currentProfile) => ({
                      ...currentProfile,
                      name: "SIMERS",
                      handle: "@simers",
                    }));
                  }}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${activePattern === pattern.id ? "border-emerald-400 bg-emerald-950 text-emerald-200" : "border-slate-700 text-slate-300"}`}
                >
                  {pattern.name}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                const id = crypto.randomUUID();
                const next = [
                  ...patterns,
                  {
                    id,
                    name: `Novo padrão SIMERS ${patterns.length + 1}`,
                    theme: "blue",
                  },
                ];
                setPatterns(next);
                setActivePattern(id);
                setTheme("blue");
                localStorage.setItem(
                  "mm-carousel-patterns",
                  JSON.stringify(next),
                );
                setMessage(
                  "Novo padrão SIMERS adicionado. Edite o nome e a identidade no painel de propriedades.",
                );
              }}
            >
              + Adicionar padrão SIMERS
            </Button>
          </div>
        </section>
      )}
      <div
        data-studio-layout="carousel"
        className={`${workspaces.find((item) => item.id === actualWorkspace)?.collapsed ? "hidden" : "grid"} min-h-[calc(100vh-215px)] items-stretch xl:grid-cols-[282px_minmax(520px,1fr)_300px]`}
      >
        <aside className="max-h-[calc(100vh-215px)] space-y-3 overflow-y-auto border-r border-slate-800 bg-[#0a1625] p-3">
          <div className="sr-only">
          <Panel title="Modo de criação">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreationMode("ai")}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${creationMode === "ai" ? "border-sky-400 bg-sky-950 text-sky-200" : "border-slate-700 text-slate-400"}`}
              >
                Criar com IA
              </button>
              <button
                type="button"
                onClick={() => setCreationMode("patterns")}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${creationMode === "patterns" ? "border-sky-400 bg-sky-950 text-sky-200" : "border-slate-700 text-slate-400"}`}
              >
                Usar padrão
              </button>
            </div>
          </Panel>
          </div>
          <Panel title="Dados da arte">
            <Field label="Modelo"><select aria-label="Modelo da arte" className={inputClass} value={theme} onChange={(event) => setTheme(event.target.value)}>{templates.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><strong className="text-xs">Padrão aplicado</strong><span className="text-[10px] text-emerald-300">SIMERS</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[["Fundo", current?.backgroundColor || "#f7f3e8"], ["Texto", current?.textColor || "#032f39"], ["Destaque", current?.highlightColor || "#071b45"]].map(([name, color]) => <div key={name}><span className="block h-7 rounded-lg border border-white/10" style={{ background: color }} /><small className="mt-1 block text-[9px] text-slate-500">{name}<br />{color}</small></div>)}</div></div>
          </Panel>
          {doc.slides.length > 0 && (
            <Panel
              title={`Artes deste trabalho (${doc.slides.length})`}
            >
              <div className="max-h-72 space-y-2 overflow-auto">
                {doc.slides.map((item, index) => (
                  <div key={item.id} className={`rounded-xl border ${selected === index ? "border-sky-400 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}>
                    <button
                      type="button"
                      onClick={() => { setSelected(index); setStep(3); }}
                      className="flex w-full items-center gap-3 p-2 text-left"
                    >
                      <span className="text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-xs text-white">{item.title || "Sem título"}</strong>
                        <span className="block truncate text-[11px] text-slate-500">{item.body || "Arte editável"}</span>
                      </span>
                      <span className="text-slate-500">{selected === index ? "⌃" : "⌄"}</span>
                    </button>
                    {selected === index && (
                      <div className="space-y-2 border-t border-slate-800 p-2">
                        <input aria-label={`Título da página ${index + 1}`} className={inputClass} value={item.title} onChange={(e) => patchSlide("title", e.target.value)} />
                        <textarea aria-label={`Texto da página ${index + 1}`} className={inputClass} rows={3} value={item.body} onChange={(e) => patchSlide("body", e.target.value)} />
                        {contentMode === "mixed" && (
                          <Field label="Tipo de mídia da página">
                            <select className={inputClass} value={item.mediaType || "image"} onChange={(e) => patchSlide("mediaType", e.target.value)}>
                              <option value="image">Imagem</option>
                              <option value="video">Vídeo</option>
                            </select>
                          </Field>
                        )}
                        {["video", "mixed"].includes(contentMode) && (
                          <Field label={`Duração da cena · ${item.duration || 4}s`}>
                            <input aria-label={`Duração da página ${index + 1}`} className="w-full accent-cyan-400" type="range" min="1" max="15" value={item.duration || 4} onChange={(e) => patchSlide("duration", Number(e.target.value))} />
                          </Field>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button
                onClick={() => {
                  patch("slides", [
                    ...doc.slides,
                    slide("Nova página", "Seu texto aqui"),
                  ]);
                  setSelected(doc.slides.length);
                  setStep(3);
                }}
              >
                <Plus size={15} /> Adicionar arte
              </Button>
            </Panel>
          )}
          <Panel title="Elementos ativos">
            <div className="grid grid-cols-4 gap-2">
              {current?.image ? (
                <img
                  src={current.image}
                  alt="Imagem da página selecionada"
                  className="aspect-square rounded-lg border border-slate-700 object-cover"
                />
              ) : (
                <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-slate-700 text-[10px] text-slate-500">
                  Imagem
                </div>
              )}
              <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-sky-700 to-cyan-300 text-[10px] font-black text-white">
                COR
              </div>
              <div className="grid aspect-square place-items-center rounded-lg border border-slate-700 bg-slate-950 text-[10px] font-black text-white">
                {profile.name?.slice(0, 8) || "MARCA"}
              </div>
              <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-sky-700 text-center text-[10px] font-bold text-sky-300">
                + Mídia
                <input
                  className="sr-only"
                  type="file"
                  accept={contentMode === "image" ? "image/*" : "image/*,video/*"}
                  onChange={async (event) => {
                    if (!event.target.files?.[0] || !current) return;
                    const file = event.target.files[0];
                    if (file.type.startsWith("video/")) {
                      patchSlide("video", await readMedia(file));
                      patchSlide("mediaType", "video");
                    } else {
                      patchSlide("image", await readImage(file));
                      patchSlide("mediaType", "image");
                    }
                  }}
                />
              </label>
            </div>
          </Panel>
          <Panel title="Referências de arte">
            <p className="mb-2 text-[11px] text-slate-400">Imagens fornecidas para orientar composição, hierarquia e acabamento.</p>
            <div className="grid grid-cols-2 gap-2">
              <img src="/reference/carousel-saude-capa.png" alt="Referência de capa SIMERS" className="aspect-[4/5] w-full rounded-lg border border-slate-700 object-cover object-top" />
              <img src="/reference/carousel-saude-conteudo.png" alt="Referência de conteúdo SIMERS" className="aspect-[4/5] w-full rounded-lg border border-slate-700 object-cover object-top" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <img src="/reference/giro-semana-capa.png" alt="Referência da capa Giro da Semana" className="aspect-[4/5] w-full rounded-lg border border-emerald-600 object-cover object-top" />
              <img src="/reference/giro-semana-interna.png" alt="Referência interna Giro da Semana" className="aspect-[4/5] w-full rounded-lg border border-emerald-600 object-cover object-top" />
            </div>
            <Button primary onClick={applyGiroTemplate}>Aplicar modelo Giro da Semana</Button>
            <details className="rounded-lg border border-slate-700 p-2">
              <summary className="cursor-pointer text-xs font-bold text-slate-200">Referências de arte única</summary>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {Array.from({ length: 7 }, (_, index) => <img key={index} src={`/reference/arte-unica-${index + 1}.png`} alt={`Referência de publicação individual ${index + 1}`} className="aspect-[4/5] w-full rounded border border-slate-700 object-cover object-top" />)}
              </div>
              <Button onClick={applySingleArtTemplate}>Criar arte única neste padrão</Button>
            </details>
          </Panel>
          {false && creationMode === "patterns" && (
            <Panel title="Padrões do projeto">
              <Field label="Modelo visual">
                <select
                  className={inputClass}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  {templates.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                onClick={() => {
                  const id = crypto.randomUUID();
                  const next = [
                    ...patterns,
                    { id, name: `Novo padrão ${patterns.length + 1}`, theme },
                  ];
                  setPatterns(next);
                  setActivePattern(id);
                  localStorage.setItem(
                    "mm-carousel-patterns",
                    JSON.stringify(next),
                  );
                }}
              >
                + Adicionar novo padrão
              </Button>
              <p className="text-xs text-slate-500">
                Os padrões SIMERS definitivos serão configurados a partir dos
                cards de referência.
              </p>
            </Panel>
          )}
          {creationMode === "ai" && (
            <Panel title={steps[step]}>
              <Field label="Título do carrossel">
                <input
                  aria-label="Título do carrossel"
                  className={inputClass}
                  value={doc.title}
                  onChange={(e) => patch("title", e.target.value)}
                />
              </Field>
              {step === 0 &&
                Object.entries({
                  name: "Nome da marca",
                  handle: "Perfil social",
                  niche: "Nicho",
                  audience: "Público",
                  tone: "Tom de voz",
                }).map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input
                      className={inputClass}
                      value={profile[k]}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, [k]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              {step === 1 && (
                <>
                  <Field label="Tema ou ideia">
                    <textarea
                      className={inputClass}
                      rows={4}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </Field>
                  <Button primary onClick={example}>
                    Usar exemplo de demonstração
                  </Button>
                  <p className="text-xs text-slate-500">
                    Você também pode escrever sua própria copy ou importar uma
                    resposta de IA.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  <Field label="Prompt para sua IA">
                    <textarea
                      className={inputClass}
                      value={prompt}
                      rows={6}
                      readOnly
                    />
                  </Field>
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(prompt);
                        setMessage("Prompt copiado.");
                      } catch {
                        setMessage("Selecione e copie o prompt acima.");
                      }
                    }}
                  >
                    <Copy size={15} />
                    Copiar prompt
                  </Button>
                  <Field label="JSON do carrossel">
                    <textarea
                      aria-label="JSON do carrossel"
                      className={inputClass}
                      rows={6}
                      value={raw}
                      onChange={(e) => setRaw(e.target.value)}
                    />
                  </Field>
                  <Button primary onClick={importJSON}>
                    Importar copy
                  </Button>
                </>
              )}
              {step === 3 && (
                <>
                  <Field label="Formato">
                    <select
                      className={inputClass}
                      value={doc.format}
                      onChange={(e) => patch("format", e.target.value)}
                    >
                      {SOCIAL_FORMATS.map((format) => (
                        <option key={format.id} value={format.id}>
                          {socialFormatLabel(format.id)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    {templates.map(([key, label, color]) => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        className={`rounded-lg border p-2 text-xs ${theme === key ? "border-sky-400" : "border-slate-700"} text-slate-300`}
                      >
                        <span
                          className="mb-2 block h-7 rounded"
                          style={{ background: color }}
                        />
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={() => {
                      patch("slides", [
                        ...doc.slides,
                        slide("Novo slide", "Seu texto aqui"),
                      ]);
                      setSelected(doc.slides.length);
                    }}
                  >
                    <Plus size={15} />
                    Adicionar slide
                  </Button>
                </>
              )}
              {step === 4 && (
                <p className="text-sm text-slate-400">
                  Seus rascunhos ficam neste navegador. O ZIP permite levar o
                  projeto para outro computador.
                </p>
              )}
            </Panel>
          )}
          {current && step === 3 && (
            <Panel title={`Editar slide ${selected + 1}`}>
              {[
                ["title", "Título"],
                ["body", "Texto"],
                ["badge", "Etiqueta"],
                ["action", "Rodapé / ação"],
              ].map(([k, l]) => (
                <Field key={k} label={l}>
                  {k === "body" ? (
                    <textarea
                      className={inputClass}
                      rows={4}
                      value={current[k]}
                      onChange={(e) => patchSlide(k, e.target.value)}
                    />
                  ) : (
                    <input
                      className={inputClass}
                      value={current[k] || ""}
                      onChange={(e) => patchSlide(k, e.target.value)}
                    />
                  )}
                </Field>
              ))}
              <Field label="Imagem de fundo">
                <input
                  className="text-xs text-slate-400"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    try {
                      patchSlide("image", await readImage(e.target.files[0]));
                    } catch (err) {
                      setMessage(err.message);
                    }
                  }}
                />
              </Field>
              {current.image && (
                <Button onClick={() => patchSlide("image", null)}>
                  Remover imagem
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  disabled={selected === 0}
                  onClick={() => {
                    const slides = [...doc.slides];
                    [slides[selected - 1], slides[selected]] = [
                      slides[selected],
                      slides[selected - 1],
                    ];
                    patch("slides", slides);
                    setSelected(selected - 1);
                  }}
                >
                  <ArrowLeft size={14} />
                </Button>
                <Button
                  disabled={selected === doc.slides.length - 1}
                  onClick={() => {
                    const slides = [...doc.slides];
                    [slides[selected + 1], slides[selected]] = [
                      slides[selected],
                      slides[selected + 1],
                    ];
                    patch("slides", slides);
                    setSelected(selected + 1);
                  }}
                >
                  <ArrowRight size={14} />
                </Button>
                <Button
                  aria-label={`Remover slide ${selected + 1}`}
                  onClick={() => {
                    patch(
                      "slides",
                      doc.slides.filter((_, i) => i !== selected),
                    );
                    setSelected(Math.max(0, selected - 1));
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Panel>
          )}
        </aside>
        <div className="min-w-0 bg-mm-studio">
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-800 bg-[#0a1625] px-4 py-3">
            <div className="min-w-[240px] flex-1"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Projeto / episódio</span>
            <select aria-label="Projeto da arte" className={inputClass} value={doc.project_id || ""} onChange={(event) => {
              const value = event.target.value;
              const project = projects.find((item) => String(item.id || item._entityId) === value);
              if (!project) { setDoc((currentDoc) => ({ ...currentDoc, project_id: null })); setMessage("Criação manual ativada. Os campos permanecem editáveis."); return; }
              const title = project.titulo || project.title || "";
              const body = project.descricao || project.description || project.pauta || project.resumo || "";
              setDoc((currentDoc) => ({ ...currentDoc, project_id: value, title: title || currentDoc.title, slides: currentDoc.slides.map((item, index) => index === 0 ? { ...item, title: title || item.title, body: body || item.body } : item) }));
              setMessage("Dados do MediaMind carregados nesta arte. O projeto original não será alterado.");
            }}><option value="">Preencher manualmente</option>{projects.map((project) => <option key={project.id || project._entityId} value={String(project.id || project._entityId)}>{project.titulo || project.title || `Projeto ${project.id || project._entityId}`}</option>)}</select></div>
            <div className="flex flex-wrap items-center gap-2"><select aria-label="Formato da arte" value={doc.format} onChange={(event) => patch("format", event.target.value)} className="rounded-lg border border-cyan-500 bg-cyan-950/40 px-3 py-2 text-xs font-bold text-cyan-200">{selectedFormats.map((format) => <option key={format} value={format}>{socialFormatLabel(format)}</option>)}</select><select aria-label="Adicionar formato" value="" onChange={(event) => { const format = event.target.value; if (!format) return; if (format === "custom") { setCustomFormatOpen(true); return; } setSelectedFormats((items) => items.includes(format) ? items : [...items, format]); setMessage("Formato adicionado. Selecione-o ao lado para editar a nova variação."); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"><option value="">+ Formato</option>{formatOptions.filter((format) => !selectedFormats.includes(format.id)).map((format) => <option key={format.id} value={format.id}>{socialFormatLabel(format.id)}</option>)}<option value="custom">Personalizado…</option></select>{doc.slides.length > 1 && <select aria-label="Modo de exportação" value={exportMode} onChange={(event) => setExportMode(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="individual">Artes individuais</option><option value="sequence">Carrossel</option></select>}<Button primary disabled={busy} onClick={exportZip}><Download size={15} />{busy ? "Gerando…" : `Baixar (${contentMode === "single" ? 1 : doc.slides.length})`}</Button></div>
          </div>
          <div className="flex min-h-12 flex-wrap items-center justify-end gap-3 border-b border-slate-800 bg-[#0a1625] px-4 py-2 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="font-bold text-cyan-300">{contentMode === "single" ? "Arte individual" : contentMode === "video" ? "Carrossel em vídeo" : contentMode === "mixed" ? "Carrossel mesclado" : "Carrossel de imagens"}</span>
              <span className="rounded-md border border-slate-700 px-2 py-1">Selecionar</span>
              <span>Texto</span><span>Imagem</span><span>Forma</span>
              <span className="border-l border-slate-700 pl-3">Zoom 65%</span>
              <span>Guias ●</span>
            </div>
          </div>
          {customFormatOpen && <div className="grid grid-cols-[minmax(140px,1fr)_100px_100px_auto_auto] gap-2 border-b border-slate-800 bg-[#0b1928] p-3">
            <input aria-label="Nome do formato personalizado" className={inputClass} value={customFormat.name} onChange={(event) => setCustomFormat((value) => ({ ...value, name: event.target.value }))} placeholder="Nome do formato" />
            <input aria-label="Largura personalizada" className={inputClass} type="number" min="100" value={customFormat.width} onChange={(event) => setCustomFormat((value) => ({ ...value, width: event.target.value }))} />
            <input aria-label="Altura personalizada" className={inputClass} type="number" min="100" value={customFormat.height} onChange={(event) => setCustomFormat((value) => ({ ...value, height: event.target.value }))} />
            <Button onClick={() => addCustomFormat(false)}>Usar neste trabalho</Button>
            <Button primary onClick={() => addCustomFormat(true)}>Adicionar e fixar formato</Button>
          </div>}
          <div className="grid grid-cols-[42px_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-2 border-r border-slate-800 bg-[#0a1625] py-3 text-slate-300">
              {["↖", "T", "□", "▧", "○", "╱", "#"].map((tool) => (
                <span key={tool} className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-sm first:border-sky-500 first:bg-sky-950 first:text-sky-300">
                  {tool}
                </span>
              ))}
            </div>
            <div className="min-w-0 space-y-4 p-4">
            <div className="flex h-6 items-end justify-between border-b border-slate-700 px-3 pb-1 text-[9px] text-slate-500">
              {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((mark) => <span key={mark}>{mark}</span>)}
            </div>
          {step === 4 ? (
            <div className="space-y-4">
              <Panel title="Projetos compartilhados no MediaMind">
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={loadRemote}>
                    Carregar projetos compartilhados
                  </Button>
                  <Button disabled={busy || !doc.slides.length} onClick={sync}>
                    Salvar no MediaMind
                  </Button>
                  <Button disabled={!record || busy} onClick={approve}>
                    Aprovar revisão
                  </Button>
                </div>
                {remote.map((item) => (
                  <div
                    key={item.id}
                    className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-3"
                  >
                    <p className="text-sm text-slate-300">
                      {item.content?.title} · revisão {item.revision}
                    </p>
                    <Button
                      onClick={() => {
                        if (!Array.isArray(item.content?.slides)) {
                          setMessage("Projeto inválido.");
                          return;
                        }
                        setDoc(item.content);
                        setRecord(item);
                        setProfile(item.content.profile || profile);
                        setTheme(item.content.theme || "night");
                        setSelected(0);
                        setStep(3);
                      }}
                    >
                      Abrir revisão
                    </Button>
                  </div>
                ))}
              </Panel>
              {drafts.length === 0 && (
                <Panel title="Nenhum projeto salvo">
                  <p className="text-sm text-slate-400">
                    Salve seu primeiro carrossel para continuar depois.
                  </p>
                </Panel>
              )}
              {drafts.map((d) => (
                <Panel key={d.id} title={d.title}>
                  <p className="text-xs text-slate-400">
                    {d.slides.length} slides · {d.format} ·{" "}
                    {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                  <Button
                    primary
                    onClick={() => {
                      setDoc(d);
                      setRecord(null);
                      setProfile(d.profile || profile);
                      setTheme(d.theme || "night");
                      setStep(3);
                      setSelected(0);
                    }}
                  >
                    Abrir projeto
                  </Button>
                  <Button
                    onClick={() => {
                      const list = drafts.filter((x) => x.id !== d.id);
                      try {
                        localStorage.setItem(
                          `mm-carousel:${projectId || "local"}`,
                          JSON.stringify(list),
                        );
                        setDrafts(list);
                      } catch {
                        setMessage("Não foi possível remover o projeto.");
                      }
                    }}
                  >
                    Excluir
                  </Button>
                </Panel>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  {doc.slides.length
                    ? contentMode === "single" ? "Arte individual · composição visual" : `${doc.slides.length} slides · sua narrativa visual`
                    : "Sua próxima história começa aqui"}
                </h3>
                {doc.slides.length > 0 && (
                  <Button onClick={() => setStep(3)}>Abrir editor</Button>
                )}
              </div>
              {!doc.slides.length ? (
                <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-gradient-to-br from-slate-900 to-sky-950/30 p-8 text-center">
                  <div className="mb-6 flex -rotate-6 gap-3">
                    {["#38bdf8", "#a78bfa", "#6ee7b7"].map((c) => (
                      <div
                        key={c}
                        className="h-32 w-24 rounded-xl border border-white/10 p-4 shadow-xl"
                        style={{
                          background: `linear-gradient(145deg,${c}33,#0f172a)`,
                        }}
                      >
                        <div
                          className="mt-8 h-2 w-12 rounded"
                          style={{ background: c }}
                        />
                        <div className="mt-3 h-1 w-14 rounded bg-white/30" />
                      </div>
                    ))}
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Ideias boas merecem um bom design
                  </h3>
                  <p className="mt-3 max-w-sm text-sm text-slate-400">
                    Configure seu perfil e use um exemplo para conhecer o
                    editor.
                  </p>
                  <div className="mt-5">
                    <Button primary onClick={example}>
                      Explorar exemplo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid items-center gap-4 rounded-xl border border-slate-800 bg-[linear-gradient(45deg,#0b1725_25%,transparent_25%),linear-gradient(-45deg,#0b1725_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0b1725_75%),linear-gradient(-45deg,transparent_75%,#0b1725_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-5 sm:grid-cols-2">
                  {doc.slides.slice(selected, selected + 2).map((s, offset) => {
                    const i = selected + offset;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelected(i);
                          setStep(3);
                        }}
                        className={`rounded-2xl border-2 p-1 text-left ${selected === i ? "border-sky-400" : "border-transparent"}`}
                      >
                        <CarouselSlideCanvas
                          slide={s}
                          format={doc.format}
                          index={i}
                          theme={theme}
                          profile={profile}
                          editable
                          layers={layers}
                          totalSlides={doc.slides.length}
                          onChange={(key, value) => patchSlide(key, value)}
                        />
                        <p className="px-2 py-2 text-xs text-slate-500">
                          Slide {i + 1} ·{" "}
                          {s.type === "cover"
                            ? "Capa"
                            : s.type === "cta"
                              ? "Chamada final"
                              : "Conteúdo"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
              {doc.slides.length > 0 && (
                <Panel title="Artes do trabalho">
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {doc.slides.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelected(index);
                          setStep(3);
                        }}
                        className={`w-24 shrink-0 rounded-lg border p-1 ${selected === index ? "border-sky-400 bg-sky-950/40" : "border-slate-700"}`}
                      >
                        <CarouselSlideCanvas
                          slide={item}
                          format={doc.format}
                          index={index}
                          theme={theme}
                          profile={profile}
                          layers={layers}
                          totalSlides={doc.slides.length}
                        />
                        <span className="mt-1 block text-[10px] text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                      </button>
                    ))}
                  </div>
                </Panel>
              )}
              <Panel title="Legenda da publicação">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={doc.caption}
                  onChange={(e) => patch("caption", e.target.value)}
                />
                <Field label="Hashtags">
                  <input
                    className={inputClass}
                    value={(doc.hashtags || []).join(" ")}
                    onChange={(e) =>
                      patch(
                        "hashtags",
                        e.target.value.split(/\s+/).filter(Boolean),
                      )
                    }
                  />
                </Field>
              </Panel>
            </>
          )}
            </div>
          </div>
        </div>
        <aside className="max-h-[calc(100vh-215px)] space-y-3 overflow-y-auto border-l border-slate-800 bg-[#0a1625] p-3">
          <div className="grid grid-cols-2 border-b border-slate-700">
            <button type="button" onClick={() => setRightPanel("properties")} className={`px-3 py-3 text-sm font-bold ${rightPanel === "properties" ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400"}`}>Propriedades</button>
            <button type="button" onClick={() => setRightPanel("layers")} className={`px-3 py-3 text-sm font-bold ${rightPanel === "layers" ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400"}`}>Camadas</button>
          </div>
          {rightPanel === "properties" ? <Panel title="Texto e página">
            {workspaceMode === "simers" && (
              <Field label="Nome do padrão SIMERS">
                <input
                  className={inputClass}
                  value={
                    patterns.find((pattern) => pattern.id === activePattern)
                      ?.name || ""
                  }
                  onChange={(e) => {
                    const next = patterns.map((pattern) =>
                      pattern.id === activePattern
                        ? { ...pattern, name: e.target.value }
                        : pattern,
                    );
                    setPatterns(next);
                    localStorage.setItem(
                      "mm-carousel-patterns",
                      JSON.stringify(next),
                    );
                  }}
                />
              </Field>
            )}
            <Field label="Assinatura / instituição">
              <input
                className={inputClass}
                value={profile.name}
                onChange={(e) =>
                  setProfile((value) => ({ ...value, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Perfil / rodapé">
              <input
                className={inputClass}
                value={profile.handle}
                onChange={(e) =>
                  setProfile((value) => ({ ...value, handle: e.target.value }))
                }
              />
            </Field>
            <Field label="Tipografia">
              <select
                className={inputClass}
                value={profile.fontFamily || "Arial, sans-serif"}
                onChange={(e) => setProfile((value) => ({ ...value, fontFamily: e.target.value }))}
              >
                <option value="Arial, sans-serif">Arial</option>
                <option value="Inter, Arial, sans-serif">Inter</option>
                <option value="Montserrat, Arial, sans-serif">Montserrat</option>
                <option value="Georgia, serif">Georgia</option>
              </select>
            </Field>
            {current && (
              <>
                {contentMode === "single" && <div className="space-y-3 rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-3">
                  <button type="button" onClick={() => setGuideOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-emerald-600/60 bg-emerald-950/40 p-3 text-left text-sm font-bold text-emerald-200"><span className="flex items-center gap-2"><BookOpen size={17} /> Guia Padrão SIMERS</span><span>Abrir quadro →</span></button>
                  <Field label="Trecho em destaque"><input aria-label="Trecho em destaque" className={inputClass} value={current.highlightText || ""} onChange={(event) => patchSlide("highlightText", event.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Fundo"><input aria-label="Cor do fundo da arte" className="h-10 w-full rounded border border-slate-700 bg-slate-950" type="color" value={current.backgroundColor || "#62d7c4"} onChange={(event) => patchSlide("backgroundColor", event.target.value)} /></Field>
                    <Field label="Texto"><input aria-label="Cor do texto da arte" className="h-10 w-full rounded border border-slate-700 bg-slate-950" type="color" value={current.textColor || "#032f39"} onChange={(event) => patchSlide("textColor", event.target.value)} /></Field>
                    <Field label="Fundo do destaque"><input aria-label="Cor do fundo do destaque" className="h-10 w-full rounded border border-slate-700 bg-slate-950" type="color" value={current.highlightColor || "#071b45"} onChange={(event) => patchSlide("highlightColor", event.target.value)} /></Field>
                    <Field label="Texto do destaque"><input aria-label="Cor do texto destacado" className="h-10 w-full rounded border border-slate-700 bg-slate-950" type="color" value={current.highlightTextColor || "#62d7c4"} onChange={(event) => patchSlide("highlightTextColor", event.target.value)} /></Field>
                  </div>
                  <Field label="Posição da fotografia"><select aria-label="Posição da fotografia" className={inputClass} value={current.imagePosition || "top"} onChange={(event) => patchSlide("imagePosition", event.target.value)}><option value="top">Foto acima</option><option value="bottom">Foto abaixo</option><option value="background">Foto como fundo</option></select></Field>
                  <Field label={`Área da foto · ${current.imageRatio || 48}%`}><input aria-label="Tamanho da fotografia" className="w-full accent-emerald-400" type="range" min="25" max="75" value={current.imageRatio || 48} onChange={(event) => patchSlide("imageRatio", Number(event.target.value))} /></Field>
                </div>}
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`Tamanho do título · ${current.titleSize || 48}`}>
                    <input aria-label="Tamanho do título" className="w-full accent-cyan-400" type="range" min="28" max="84" value={current.titleSize || 48} onChange={(e) => patchSlide("titleSize", Number(e.target.value))} />
                  </Field>
                  <Field label={`Tamanho do texto · ${current.bodySize || 18}`}>
                    <input aria-label="Tamanho do texto" className="w-full accent-cyan-400" type="range" min="12" max="40" value={current.bodySize || 18} onChange={(e) => patchSlide("bodySize", Number(e.target.value))} />
                  </Field>
                </div>
                <Field label="Alinhamento">
                  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-700">
                    {[['left','Esquerda'],['center','Centro'],['right','Direita']].map(([value,label]) => <button key={value} type="button" onClick={() => patchSlide("textAlign", value)} className={`px-2 py-2 text-xs ${current.textAlign === value ? "bg-sky-700 text-white" : "bg-slate-950 text-slate-400"}`}>{label}</button>)}
                  </div>
                </Field>
                <Field label={`Entrelinha · ${(current.lineHeight || 1.05).toFixed(2)}`}>
                  <input aria-label="Entrelinha do slide" className="w-full accent-cyan-400" type="range" min="0.9" max="1.6" step="0.05" value={current.lineHeight || 1.05} onChange={(e) => patchSlide("lineHeight", Number(e.target.value))} />
                </Field>
                <Field label={`Espaço entre letras · ${current.letterSpacing || 0}px`}>
                  <input aria-label="Espaço entre letras" className="w-full accent-cyan-400" type="range" min="-2" max="8" step="0.5" value={current.letterSpacing || 0} onChange={(e) => patchSlide("letterSpacing", Number(e.target.value))} />
                </Field>
              </>
            )}
            <Field label="Formato do projeto">
              <select
                className={inputClass}
                value={doc.format}
                onChange={(e) => patch("format", e.target.value)}
              >
                {formatOptions.map((format) => (
                  <option key={format.id} value={format.id}>
                    {socialFormatLabel(format.id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Modelo visual">
              <select
                className={inputClass}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                {templates.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {current ? (
              <>
                <Field label="Título do slide">
                  <input
                    className={inputClass}
                    value={current.title}
                    onChange={(e) => patchSlide("title", e.target.value)}
                  />
                </Field>
                <Field label="Texto do slide">
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={current.body}
                    onChange={(e) => patchSlide("body", e.target.value)}
                  />
                </Field>
                <Field label="Rodapé / ação">
                  <input
                    className={inputClass}
                    value={current.action || ""}
                    onChange={(e) => patchSlide("action", e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Adicione uma página para editar suas propriedades.
              </p>
            )}
            <Button disabled={!doc.slides.length} onClick={() => setStep(3)}>
              Aplicar no editor
            </Button>
            <Button disabled={!current} onClick={() => {
              if (!current) return;
              const style = { titleSize: current.titleSize, bodySize: current.bodySize, textAlign: current.textAlign, lineHeight: current.lineHeight, letterSpacing: current.letterSpacing };
              patch("slides", doc.slides.map((item) => ({ ...item, ...style })));
              setMessage("Estilo aplicado a todas as páginas.");
            }}>Aplicar estilo a todas</Button>
            <Button disabled={!current} onClick={() => {
              patchSlide("titleSize", 48); patchSlide("bodySize", 18); patchSlide("textAlign", "left"); patchSlide("lineHeight", 1.05); patchSlide("letterSpacing", 0);
            }}>Restaurar padrão</Button>
          </Panel> : <Panel title="Camadas da página">
            {layers.map(
              (layer, index) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300"
                >
                  <span>{layer.label}</span>
                  <span className="flex gap-1">
                    <button type="button" aria-label={`${layer.visible ? "Ocultar" : "Mostrar"} ${layer.label}`} onClick={() => setLayers((items) => items.map((item) => item.id === layer.id ? { ...item, visible: !item.visible } : item))} className="rounded border border-slate-700 px-2 py-1">{layer.visible ? "◉" : "○"}</button>
                    <button type="button" aria-label={`${layer.locked ? "Desbloquear" : "Bloquear"} ${layer.label}`} onClick={() => setLayers((items) => items.map((item) => item.id === layer.id ? { ...item, locked: !item.locked } : item))} className="rounded border border-slate-700 px-2 py-1">{layer.locked ? "🔒" : "◇"}</button>
                    <button type="button" aria-label={`Subir ${layer.label}`} disabled={index === 0} onClick={() => setLayers((items) => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-30">↑</button>
                  </span>
                </div>
              ),
            )}
          </Panel>}
        </aside>
      </div>
      {guideOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Guia Padrão SIMERS">
        <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-emerald-700 bg-[#071522] shadow-2xl">
          <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-800 bg-[#071522]/95 p-5">
            <div><p className="text-xs font-black uppercase tracking-widest text-emerald-400">Identidade visual</p><h2 className="text-2xl font-black text-white">Guia Padrão SIMERS</h2><p className="mt-1 text-sm text-slate-400">Escolha um modelo ou consulte as regras antes de editar.</p></div>
            <button type="button" aria-label="Fechar guia SIMERS" onClick={() => setGuideOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button>
          </header>
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {singleArtPresets.map((preset) => <button key={`${preset.name}-guide`} type="button" aria-label={`Aplicar padrão ${preset.name}`} onClick={() => { applySingleArtModel(preset); setGuideOpen(false); }} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-left hover:border-emerald-400"><img src={`/reference/arte-unica-${preset.image}.png`} alt="" className="aspect-[4/5] w-full object-cover object-top" /><span className="block p-3 text-sm font-bold text-white">{preset.name}</span></button>)}
              <button type="button" onClick={() => { applyGiroTemplate(); setGuideOpen(false); }} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-left hover:border-emerald-400"><img src="/reference/giro-semana-capa.png" alt="" className="aspect-[4/5] w-full object-cover object-top" /><span className="block p-3 text-sm font-bold text-white">Giro da Semana</span></button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="font-bold text-white">Composição</h3><p className="mt-2 text-sm leading-6 text-slate-400">Foto documental sem filtros pesados. Bloco de informação separado, margens seguras e assinatura SIMERS na base.</p></article>
              <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="font-bold text-white">Texto e destaque</h3><p className="mt-2 text-sm leading-6 text-slate-400">Leitura imediata, alto contraste e somente uma expressão principal destacada por arte.</p></article>
              <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="font-bold text-white">Cores</h3><p className="mt-2 text-sm leading-6 text-slate-400">Use as combinações cadastradas como base. Ajustes continuam disponíveis nos controles da arte.</p></article>
            </div>
          </div>
        </section>
      </div>}
      <div
        ref={exportsRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 -left-[10000px]"
        style={{ width: 432 }}
      >
        {doc.slides.map((s, i) => (
          <CarouselSlideCanvas
            key={s.id}
            slide={s}
            index={i}
            format={doc.format}
            theme={theme}
            profile={profile}
            layers={layers}
            totalSlides={doc.slides.length}
          />
        ))}
      </div>
    </section>
  );
}
