import StudioProjectBar from "./StudioProjectBar";
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
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;
    const update = () => setVoices(synthesis.getVoices());
    update();
    synthesis.addEventListener("voiceschanged", update);
    return () => {
      synthesis.removeEventListener("voiceschanged", update);
      synthesis.cancel();
    };
  }, []);
  const [tab, setTab] = useState("texto"), [favorites, setFavorites] = useState([]), [history, setHistory] = useState([]), [sample, setSample] = useState(null), [consent, setConsent] = useState(false);
  useEffect(() => () => { if (sample?.url?.startsWith("blob:")) URL.revokeObjectURL(sample.url); }, [sample]);
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
    setHistory((items) => [{ id: crypto.randomUUID(), text, voice: speech.voice?.name || "Padrão", date: new Date().toLocaleString("pt-BR"), speed, pitch }, ...items].slice(0,30));
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
      <StudioProjectBar tool="voice-studio" value={{ text, voice, speed, pitch, favorites, history, sample }} onLoad={(v) => { setText(v.text || ""); setVoice(v.voice || ""); setSpeed(Number(v.speed) || 1); setPitch(Number(v.pitch) || 1); setFavorites(Array.isArray(v.favorites) ? v.favorites : []); setHistory(Array.isArray(v.history) ? v.history : []); setSample(v.sample || null); }} />
      <Notice>{message}</Notice>
      <div role="tablist" aria-label="Estúdio de voz" className="flex flex-wrap gap-2">{[['texto','Texto e voz'],['vozes','Vozes favoritas'],['historico','Histórico de prévias'],['referencia','Referência de voz']].map(([id,label]) => <button role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)} className={`rounded-xl border px-4 py-2 text-sm ${tab === id ? 'border-sky-400 bg-sky-500/10 text-sky-300' : 'border-slate-700 text-slate-400'}`}>{label}</button>)}</div>
      {tab === 'vozes' && <Panel title="Catálogo do dispositivo"><div className="grid gap-3 md:grid-cols-3">{list.map((v) => <div key={v.voiceURI} className="space-y-2 rounded-xl border border-slate-700 p-4"><strong className="text-sm text-white">{v.name}</strong><p className="text-xs text-slate-500">{v.lang} · {v.localService ? 'Voz do dispositivo' : 'Serviço do navegador'}</p><Button primary={voice === v.voiceURI} onClick={() => { setVoice(v.voiceURI); setTab('texto'); }}>Selecionar voz</Button><Button onClick={() => setFavorites((items) => items.includes(v.voiceURI) ? items.filter((i) => i !== v.voiceURI) : [...items,v.voiceURI])}>{favorites.includes(v.voiceURI) ? '★ Favorita' : '☆ Favoritar'}</Button></div>)}</div>{!list.length && <p className="text-sm text-slate-500">Nenhuma voz foi disponibilizada por este navegador.</p>}</Panel>}
      {tab === 'historico' && <Panel title="Histórico de prévias">{history.map((item) => <div key={item.id} className="mb-3 rounded-xl border border-slate-700 p-4"><p className="text-xs text-sky-300">{item.voice} · {item.date}</p><p className="my-2 line-clamp-3 text-sm text-slate-300">{item.text}</p><Button onClick={() => { setText(item.text); setSpeed(item.speed); setPitch(item.pitch); setTab('texto'); }}>Reutilizar texto e parâmetros</Button></div>)}{!history.length && <p className="text-sm text-slate-500">As prévias ouvidas aparecem aqui. São registros de texto e parâmetros, não arquivos de áudio.</p>}</Panel>}
      {tab === 'referencia' && <Panel title="Amostra para direção de voz"><input aria-label="Amostra de voz" type="file" accept="audio/*" onChange={(e) => { const f = e.target.files[0]; if (f?.type.startsWith('audio/')) setSample({name:f.name,url:URL.createObjectURL(f)}); }} />{sample && <audio className="w-full" controls src={sample.url} />}<label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Tenho autorização para usar esta amostra de voz.</label><p className="text-sm text-slate-400">A amostra pode ser ouvida e salva no projeto como referência. Clonagem e síntese com a amostra dependem de um provedor integrado.</p><Button disabled>Clonar voz · motor não conectado</Button></Panel>}
      {tab === 'texto' && <>
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
          <Button onClick={() => setText((t) => t.replace(/[ \t]+/g, " ").replace(/ +\n/g, "\n").trim())}>Normalizar espaços do texto</Button>
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
      </div></>}
    </section>
  );
}

