import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Upload, Music, Sparkles, Info, ChevronDown,
  FileVideo, FileAudio, FileImage, FileText, Check,
} from 'lucide-react';
import { uploadFile } from '../../api/uploads';
import { base44 } from '../../api/base44Client';

const PROGRAMS = ['Jornal do Meio Dia', 'Jornal da Noite', 'Especial Enchentes RS', 'Documentário Turismo', 'Campanha Institucional'];
const STEPS = ['Criar pacote', 'Adicionar arquivos', 'Revisar e iniciar'];

const FILE_ICONS = { video: FileVideo, audio: FileAudio, image: FileImage, document: FileText };

export default function IngestNewPackage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [program, setProgram] = useState('');
  const [files, setFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [audioDragOver, setAudioDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef(null);
  const audioInput = useRef(null);
  const navigate = useNavigate();

  function addFiles(selected) {
    const entries = Array.from(selected || []).map((file) => ({
      id: crypto.randomUUID(), file, name: file.name, type: classifyFile(file),
      size: formatFileSize(file.size), status: 'pending',
    }));
    setFiles((prev) => [...prev, ...entries]);
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function continueFlow() {
    if (step < 3) { setStep(step + 1); return; }
    if (!name || files.length === 0 || uploading) return;
    setUploading(true);
    setUploadError('');
    try {
      for (const entry of files) {
        setFiles((current) => current.map((item) => item.id === entry.id ? { ...item, status: 'uploading' } : item));
        const uploaded = await uploadFile(entry.file);
        await base44.entities.Asset.create({
          title: entry.name, filename: entry.name, asset_type: entry.type,
          file_size: entry.file.size, file_url: uploaded.file_url,
          package_name: name, folder, program_name: program, ai_status: aiEnabled ? 'pending' : 'disabled',
        });
        setFiles((current) => current.map((item) => item.id === entry.id ? { ...item, status: 'uploaded' } : item));
      }
      navigate('/ingest');
    } catch {
      setUploadError('Não foi possível enviar todos os arquivos. Os concluídos foram preservados; tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <button
          onClick={() => navigate('/ingest')}
          className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-400"
        >
          <ArrowLeft size={13} /> Voltar para ingestões
        </button>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-50">Nova Ingestão</h1>
            <p className="mt-0.5 text-sm text-slate-400">Prepare vários pacotes e continue trabalhando enquanto os arquivos são enviados.</p>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">
            <Plus size={14} /> Novo pacote
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                    isActive
                      ? 'border-sky-500 bg-sky-500 text-slate-950'
                      : isDone
                        ? 'border-sky-500 bg-sky-950/40 text-sky-400'
                        : 'border-slate-700 bg-slate-950 text-slate-500'
                  }`}>
                    {isDone ? <Check size={14} /> : stepNum}
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${isActive ? 'text-sky-400' : 'text-slate-600'}`}>
                      Etapa {stepNum}
                    </p>
                    <p className={`text-sm font-medium ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{label}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${step > stepNum ? 'bg-sky-500' : 'bg-slate-700'}`} style={{ minWidth: '2rem' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 px-6 py-5">
        <div className="max-w-2xl space-y-5">
          {/* Section: Criar novo pacote */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Criar novo pacote</h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Nome do pacote <span className="text-rose-400">*</span></span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Pacote 01 — Entrevistas"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Pasta de destino (opcional)</span>
                  <input
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="Ex.: /Centro Histórico/Entrevistas"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                </label>
              </div>

              {/* Program dropdown */}
              <label className="mt-3 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-300">Programa / Projeto</span>
                <div className="relative">
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-9 text-sm outline-none focus:border-sky-500"
                  >
                    <option value="">Selecione...</option>
                    {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </label>
            </div>
          </div>

          {/* Section: Drag-and-drop files */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Arquivos do pacote</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragOver ? 'border-sky-500 bg-sky-950/20' : 'border-slate-700 bg-slate-950/40'
              }`}
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800">
                <Upload size={24} className="text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-300">Arraste e solte arquivos aqui</p>
              <p className="mt-1 text-xs text-slate-500">Vídeos, áudios, imagens ou documentos</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <button onClick={() => fileInput.current?.click()} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800">
                  <Plus size={12} /> Adicionar arquivos
                </button>
                <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {files.map((f) => {
                  const Icon = FILE_ICONS[f.type] || FileText;
                  return (
                    <div key={f.id} className="group flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <Icon size={15} className="text-slate-400" />
                      <span className="flex-1 text-sm text-slate-200">{f.name}</span>
                      <span className="text-xs text-slate-500">{f.size}</span>
                      <span className="text-[10px] uppercase text-sky-400">{f.status === 'uploaded' ? 'Enviado' : f.status === 'uploading' ? 'Enviando' : 'Pendente'}</span>
                      <button onClick={() => removeFile(f.id)} className="text-slate-600 hover:text-rose-400">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Áudio de referência */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Music size={14} className="text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Áudio de referência (opcional)</h2>
            </div>
            <p className="mb-2 text-xs text-slate-500">Melhora a precisão da transcrição (Whisper)</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setAudioDragOver(true); }}
              onDragLeave={() => setAudioDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setAudioDragOver(false); setAudioFile(e.dataTransfer.files?.[0] || null); }}
              className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                audioDragOver ? 'border-sky-500 bg-sky-950/20' : 'border-slate-700 bg-slate-950/40'
              }`}
            >
              {audioFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-200">
                  <Music size={14} className="text-sky-400" /> {audioFile.name}
                  <button onClick={() => setAudioFile(null)} className="ml-2 text-slate-600 hover:text-rose-400">✕</button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-slate-400">Arraste o áudio aqui ou</p>
                  <button
                    onClick={() => audioInput.current?.click()}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Selecionar áudio
                  </button>
                  <input ref={audioInput} type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                  <p className="text-[11px] text-slate-600">Formatos: mp3, wav, m4a</p>
                </div>
              )}
            </div>
          </div>

          {/* Section: AI Settings */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles size={16} className="mt-0.5 text-sky-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">Configurações de IA do pacote</p>
                  <p className="mt-0.5 text-xs text-slate-500">Padrão aplicado a todos os arquivos.</p>
                </div>
              </div>
              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${aiEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${aiEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {!aiEnabled && (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2.5">
                <Info size={15} className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <p className="text-xs text-amber-200">
                    Com a IA desligada, os arquivos serão enviados no modo Express e entrarão como IA pendente.
                  </p>
                  <span className="mt-1 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    IA DESLIGADA
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-950/80 px-6 py-3 backdrop-blur">
        {uploadError && <p className="mr-auto text-xs text-rose-400">{uploadError}</p>}
        <button
          disabled
          title="Persistência de pacotes disponível após a conexão com o backend de ingestão"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Salvar e criar outro
        </button>
        <button
          onClick={continueFlow}
          disabled={uploading || (step === 3 && (!name || files.length === 0))}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400"
        >
          {uploading ? 'Enviando…' : step === 3 ? 'Iniciar envio' : 'Criar pacote e continuar →'}
        </button>
      </div>
    </div>
  );
}

export function classifyFile(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  return 'document';
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
