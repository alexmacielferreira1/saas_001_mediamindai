import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import {
  Button,
  Field,
  Panel,
  StudioHeader,
  Notice,
  inputClass,
  ExportDraft,
} from "./StudioUI";
export default function VoiceStudio() {
  const [text, setText] = useState(
      "Bem-vindo ao MediaMind. Transforme suas ideias em conteúdo com clareza e personalidade.",
    ),
    [voices, setVoices] = useState([]),
    [voice, setVoice] = useState(""),
    [speed, setSpeed] = useState(1),
    [pitch, setPitch] = useState(1),
    [speaking, setSpeaking] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", update);
      window.speechSynthesis.cancel();
    };
  }, []);
  const available = voices.filter((v) => v.lang.startsWith("pt"));
  const list = available.length ? available : voices;
  function preview() {
    if (!window.speechSynthesis) {
      setMessage("Este navegador não oferece prévia de voz.");
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.voice = voices.find((v) => v.voiceURI === voice) || list[0] || null;
    speech.lang = speech.voice?.lang || "pt-BR";
    speech.rate = speed;
    speech.pitch = pitch;
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => {
      setSpeaking(false);
      setMessage(
        "Não foi possível reproduzir esta voz. Tente outra voz do navegador.",
      );
    };
    setSpeaking(true);
    window.speechSynthesis.speak(speech);
  }
  return (
    <section className="space-y-5">
      <StudioHeader
        title="Estúdio de Narração"
        description="Revise seu texto, escolha uma voz disponível e escute a leitura antes de produzir a faixa final."
      >
        <ExportDraft
          value={{ tool: "voice-studio", text, voice, speed, pitch }}
          name="mediamind-narracao.json"
        />
      </StudioHeader>
      <Notice>{message}</Notice>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Texto da narração">
          <textarea
            className={inputClass}
            rows={13}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{text.length} caracteres</span>
            <span>
              ~{Math.ceil(text.trim().split(/\s+/).length / 2.5)}s de leitura
            </span>
          </div>
          <div className="flex gap-3">
            <Button primary disabled={!text.trim()} onClick={preview}>
              <Play size={16} />
              Ouvir prévia
            </Button>
            <Button
              disabled={!speaking}
              onClick={() => {
                window.speechSynthesis.cancel();
                setSpeaking(false);
              }}
            >
              <Square size={16} />
              Parar
            </Button>
          </div>
        </Panel>
        <Panel title="Direção de voz">
          <div className="flex h-20 items-center justify-center gap-1 rounded-xl bg-sky-500/5">
            {Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className={`w-1 rounded bg-sky-400/60 ${speaking ? "animate-pulse" : ""}`}
                style={{
                  height: 12 + Math.sin(i * 2) * 10 + (i % 4) * 6,
                  animationDelay: `${i * 30}ms`,
                }}
              />
            ))}
          </div>
          <Field label="Voz do navegador">
            <select
              className={inputClass}
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              <option value="">Padrão do dispositivo</option>
              {list.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} · {v.lang}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Velocidade · ${speed.toFixed(1)}×`}>
            <input
              className="w-full accent-sky-400"
              type="range"
              min=".5"
              max="1.5"
              step=".1"
              value={speed}
              onChange={(e) => setSpeed(+e.target.value)}
            />
          </Field>
          <Field label={`Tom · ${pitch.toFixed(1)}`}>
            <input
              className="w-full accent-sky-400"
              type="range"
              min=".5"
              max="1.5"
              step=".1"
              value={pitch}
              onChange={(e) => setPitch(+e.target.value)}
            />
          </Field>
          <p className="text-xs leading-relaxed text-slate-500">
            Prévia com as vozes do seu dispositivo. Algumas vozes podem usar
            serviços do navegador. Exportação MP3/WAV e catálogo de vozes de IA
            disponíveis em breve.
          </p>
          <Button disabled>Baixar MP3 / WAV</Button>
        </Panel>
      </div>
    </section>
  );
}
