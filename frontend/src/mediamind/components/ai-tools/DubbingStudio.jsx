import { useWorkDraftState } from "../../lib/workProtection";
import { useEffect, useState } from "react";
import {
  Button,
  Field,
  Panel,
  StudioHeader,
  Notice,
  inputClass,
  downloadBlob,
} from "./StudioUI";
import StudioProjectBar from "./StudioProjectBar";
import { buildSrt } from "../../lib/creativeToolDocuments";
export default function DubbingStudio() {
  const [source, setSource] = useState(null),
    [text, setText] = useWorkDraftState("components/ai-tools/DubbingStudio.jsx:text", ""),
    [segments, setSegments] = useWorkDraftState("components/ai-tools/DubbingStudio.jsx:segments", []),
    [language, setLanguage] = useWorkDraftState("components/ai-tools/DubbingStudio.jsx:language", "pt-BR"),
    [speed, setSpeed] = useState(1),
    [message, setMessage] = useState("");
  useEffect(
    () => () => {
      if (source?.url?.startsWith("blob:")) URL.revokeObjectURL(source.url);
      window.speechSynthesis?.cancel();
    },
    [source],
  );
  function patch(id, key, value) {
    setSegments((list) =>
      list.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
    );
  }
  function preview() {
    if (!window.speechSynthesis) {
      setMessage("Este navegador não oferece prévia de voz.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      segments.map((s) => s.translation || s.text).join(". "),
    );
    utterance.lang = language;
    utterance.rate = speed;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setMessage(
      "Reproduzindo uma prévia de voz. Não é uma faixa sincronizada ou voz clonada.",
    );
  }
  function exportSrt() {
    if (
      segments.some(
        (s) =>
          !Number.isFinite(Number(s.start)) ||
          !Number.isFinite(Number(s.end)) ||
          Number(s.start) < 0 ||
          Number(s.end) <= Number(s.start),
      )
    ) {
      setMessage("Cada trecho precisa terminar depois de seu início.");
      return;
    }
    downloadBlob(
      new Blob([buildSrt(segments)], { type: "text/plain;charset=utf-8" }),
      "mediamind-dublagem.srt",
    );
  }
  return (
    <section className="space-y-5">
      <StudioHeader
        title="Dublagem e Tradução"
        description="Prepare o vídeo, revise os trechos e a tradução, escolha o idioma e confira a narração antes da produção final."
      />
      <StudioProjectBar
        tool="ai-dubbing"
        value={{ source, text, segments, language, speed }}
        onLoad={(v) => {
          setSource(v.source || null);
          setText(v.text || "");
          setSegments(Array.isArray(v.segments) ? v.segments : []);
          setLanguage(v.language || "pt-BR");
          setSpeed(Number(v.speed) || 1);
        }}
      />
      <Notice>{message}</Notice>
      <div
        data-studio-layout="dubbing"
        className="grid items-start gap-4 xl:grid-cols-[280px_minmax(460px,1fr)_280px]"
      >
        <aside className="space-y-4">
          <Panel title="Arquivo de origem" number="01">
            <input
              aria-label="Arquivo para dublagem"
              type="file"
              accept="video/*,audio/*"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f && /^(video|audio)\//.test(f.type))
                  setSource({
                    name: f.name,
                    url: URL.createObjectURL(f),
                    type: f.type,
                  });
              }}
            />
            <p className="text-xs text-slate-500">
              Envie um vídeo ou áudio para revisar junto com os trechos.
            </p>
          </Panel>
          <Panel title="Texto original" number="02">
            <textarea
              aria-label="Texto original"
              className={inputClass}
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole a transcrição, uma fala por linha."
            />
            <Button
              primary
              disabled={!text.trim()}
              onClick={() => {
                setSegments(
                  text
                    .split(/\n+/)
                    .filter((l) => l.trim())
                    .map((l, i) => ({
                      id: crypto.randomUUID(),
                      start: i * 5,
                      end: (i + 1) * 5,
                      text: l,
                      translation: "",
                    })),
                );
                setMessage(
                  "Trechos organizados com tempos iniciais de 5 segundos. Ajuste os tempos e escreva a tradução; não houve transcrição ou tradução automática.",
                );
              }}
            >
              Organizar trechos
            </Button>
          </Panel>
        </aside>
        <div className="space-y-4">
          {source &&
            (source.type?.startsWith("video") ? (
              <video
                controls
                src={source.url}
                className="max-h-96 w-full rounded-xl bg-black"
              />
            ) : (
              <audio controls src={source.url} className="w-full" />
            ))}
          <Panel title="Trechos para revisar">
            {segments.map((s, i) => (
              <div
                key={s.id}
                className="grid gap-3 rounded-xl border border-slate-700 p-3 md:grid-cols-[120px_1fr_1fr]"
              >
                <div className="space-y-2 text-xs text-slate-400">
                  <strong>FALA {i + 1}</strong>
                  <label className="block">
                    Início (s)
                    <input
                      aria-label={`Início da fala ${i + 1}`}
                      type="number"
                      min="0"
                      step="0.1"
                      className={inputClass}
                      value={s.start}
                      onChange={(e) =>
                        patch(s.id, "start", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="block">
                    Fim (s)
                    <input
                      aria-label={`Fim da fala ${i + 1}`}
                      type="number"
                      min="0"
                      step="0.1"
                      className={inputClass}
                      value={s.end}
                      onChange={(e) =>
                        patch(s.id, "end", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <Field label="Original">
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={s.text}
                    onChange={(e) => patch(s.id, "text", e.target.value)}
                  />
                </Field>
                <Field label="Tradução / adaptação">
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={s.translation}
                    onChange={(e) => patch(s.id, "translation", e.target.value)}
                  />
                </Field>
              </div>
            ))}
            {!segments.length && (
              <p className="text-sm text-slate-500">
                Organize as falas para editar os tempos e a tradução.
              </p>
            )}
          </Panel>
        </div>
        <aside className="space-y-4">
          <Panel title="Tradução e dublagem" number="03">
            <Field label="Idioma de origem">
              <select className={inputClass} defaultValue="pt-BR">
                <option value="pt-BR">Português (Brasil)</option>
              </select>
            </Field>
            <Field label="Idioma de destino">
              <select
                className={inputClass}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {[
                  ["pt-BR", "Português (Brasil)"],
                  ["en-US", "Inglês"],
                  ["es-ES", "Espanhol"],
                  ["fr-FR", "Francês"],
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Velocidade · ${speed}×`}>
              <input
                className="w-full accent-sky-400"
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(+e.target.value)}
              />
            </Field>
            <Button primary disabled={!segments.length} onClick={preview}>
              Gerar prévia de voz
            </Button>
            <Button onClick={() => window.speechSynthesis?.cancel()}>
              Parar prévia
            </Button>
          </Panel>
          <Panel title="Exportação" number="04">
            <Button disabled={!segments.length} onClick={exportSrt}>
              Baixar legenda SRT revisada
            </Button>
            <p className="text-xs leading-relaxed text-slate-500">
              A revisão, os idiomas e os tempos ficam salvos no projeto. A faixa
              sincronizada depende do provedor de voz configurado.
            </p>
          </Panel>
        </aside>
      </div>
    </section>
  );
}
