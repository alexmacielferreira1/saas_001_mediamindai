import { useRef, useState } from "react";
import {
  Plus,
  Save,
  Download,
  Copy,
  ArrowLeft,
  ArrowRight,
  Trash2,
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
import { useProducaoProjetos } from "../../lib/producaoStore";
import CarouselSlideCanvas from "./CarouselSlideCanvas";
import {
  Button,
  Panel,
  Field,
  StudioHeader,
  Notice,
  inputClass,
  downloadBlob,
  readImage,
} from "../ai-tools/StudioUI";
const steps = ["Meu perfil", "Ideias", "Copy", "Editor", "Projetos"];
const templates = [
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
});
export default function CarouselStudio({ projectId = null }) {
  const projects = useProducaoProjetos();
  const [doc, setDoc] = useState(() =>
    createCarouselDocument({
      project: projects.find((p) => String(p.id) === String(projectId)),
    }),
  );
  const [step, setStep] = useState(0),
    [profile, setProfile] = useState({
      name: "MediaMind",
      handle: "@mediamind",
      niche: "Conteúdo e comunicação",
      audience: "Profissionais e empreendedores",
      tone: "Direto e educativo",
    }),
    [topic, setTopic] = useState(
      "Como transformar uma ideia em conteúdo que gera conexão",
    ),
    [theme, setTheme] = useState("night"),
    [selected, setSelected] = useState(0),
    [raw, setRaw] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
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
  const [record, setRecord] = useState(null);
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
        "mediamind-carrossel.zip",
      );
      setMessage("ZIP exportado com PNGs em 1080 px e o projeto em JSON.");
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
    <section className="space-y-5">
      <StudioHeader
        title="Carrossel IA"
        description="Do briefing ao carrossel: organize ideias, revise a copy e dê personalidade a cada slide."
      >
        <Button onClick={save}>
          <Save size={16} />
          Salvar projeto
        </Button>
        <Button primary disabled={busy} onClick={exportZip}>
          <Download size={16} />
          {busy ? "Exportando…" : "Exportar ZIP"}
        </Button>
      </StudioHeader>
      <div className="grid grid-cols-5 gap-2">
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
      <Notice>{message}</Notice>
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
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
                    <option>4:5</option>
                    <option>1:1</option>
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
        <div className="space-y-4">
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
                    ? `${doc.slides.length} slides · sua narrativa visual`
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
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {doc.slides.map((s, i) => (
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
                  ))}
                </div>
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
          />
        ))}
      </div>
    </section>
  );
}
