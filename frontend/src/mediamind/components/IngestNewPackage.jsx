import { useWorkDraftState } from "../lib/workProtection";
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Upload, Music, Sparkles, Info, ChevronDown,
  FileVideo, FileAudio, FileImage, FileText, Check,
} from 'lucide-react';
import { GENERIC_UPLOAD_LIMIT_BYTES, uploadFile } from '../../api/uploads';
import { MEDIA_UPLOAD_LIMIT_BYTES, isSupportedMediaFile, uploadMediaAsset, uploadMediaAssetWithProgress } from '../../api/media';
import { base44 } from '../../api/base44Client';
import { readLocalDemoSession } from '../lib/demoAccess';
import { measureFileDuration } from '../lib/mediaDuration';
import { pendingUploadEntries } from '../lib/ingestUploadPlan';
import { createIngestPackage, runIngestPackage } from '../../api/ingest';
import IngestFolderPicker from './IngestFolderPicker';

const PROGRAMS = ['Jornal do Meio Dia', 'Jornal da Noite', 'Especial Enchentes RS', 'Documentário Turismo', 'Campanha Institucional'];
const STEPS = ['Criar pacote', 'Adicionar arquivos', 'Revisar e iniciar'];

const FILE_ICONS = { video: FileVideo, audio: FileAudio, image: FileImage, document: FileText };

export default function IngestNewPackage() {
  const [step, setStep] = useWorkDraftState("ingest:step", 1);
  const [name, setName] = useWorkDraftState("ingest:name", '');
  const [folder, setFolder] = useWorkDraftState("ingest:folder", '');
  const [program, setProgram] = useWorkDraftState("ingest:program", '');
  const [files, setFiles] = useWorkDraftState("ingest:files", []);
  const [audioFile, setAudioFile] = useWorkDraftState("ingest:audioFile", null);
  // Arquivos escolhidos na pasta de referência do servidor (caminhos relativos à entrada).
  const [folderFiles, setFolderFiles] = useWorkDraftState("ingest:folderFiles", []);
  const [folderPackage, setFolderPackage] = useState(null);
  const demoSession = Boolean(readLocalDemoSession());
  const [aiEnabled, setAiEnabled] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [audioDragOver, setAudioDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [progress, setProgress] = useState({});
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

  const updateEntry = (id, patch) => setFiles((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  // Envia um arquivo. Vídeo, áudio e imagem vão para a rota real de mídia
  // (POST /media/assets: grava o arquivo da empresa, sha256 e duração, e cria o
  // Asset que toca nos editores); o pacote é anotado nesse mesmo registro.
  // Documentos seguem por /uploads + Asset. Reenvio não duplica: se o arquivo
  // já subiu (assetId), só os metadados são regravados.
  async function uploadEntry(entry) {
    const demo = Boolean(readLocalDemoSession());
    const packageData = {
      package_name: name.trim() || null, folder: folder.trim() || null, program_name: program || null,
      ai_status: aiEnabled ? 'pending' : 'disabled',
    };
    updateEntry(entry.id, { status: 'uploading', error: '' });
    setProgress((current) => ({ ...current, [entry.id]: 0 }));
    const onProgress = (value) => setProgress((current) => ({ ...current, [entry.id]: value }));
    try {
      if (!entry.file) throw new Error('O arquivo não está mais disponível nesta página. Remova a linha e adicione o arquivo de novo.');
      const isMediaType = ['video', 'audio', 'image'].includes(entry.type);
      if (demo && ['video', 'audio'].includes(entry.type)) {
        const uploaded = await uploadMediaAsset(entry.file);
        await base44.entities.Asset.create({
          title: entry.name, filename: entry.name, asset_type: entry.type,
          file_size: entry.file.size, file_url: uploaded.file_url || uploaded.stream_url,
          file_sha256: uploaded.sha256, media_asset_id: uploaded.id || null, ...packageData,
        });
      } else if (isMediaType) {
        if (!isSupportedMediaFile(entry.file)) {
          throw new Error('Formato não aceito pelo Acervo. Use MP4, MOV, WEBM, AVI, MP3, WAV, M4A, AAC, OGG, JPG, PNG ou WEBP.');
        }
        if (entry.file.size > MEDIA_UPLOAD_LIMIT_BYTES) throw new Error('Arquivo maior que 4 GB, o limite de envio de mídia.');
        let assetId = entry.assetId;
        let measured = null;
        let serverDuration = 0;
        if (!assetId) {
          // Duração lida do próprio arquivo enquanto sobe (o servidor sem ffprobe não mede).
          const [uploaded, duration] = await Promise.all([
            uploadMediaAssetWithProgress(entry.file, { origin: 'ingest' }, { onProgress }),
            entry.type === 'image' ? null : measureFileDuration(entry.file).catch(() => null),
          ]);
          if (!uploaded?.id) throw new Error('O servidor não devolveu o registro da mídia.');
          assetId = uploaded.id;
          measured = duration;
          serverDuration = Number(uploaded.duration) || 0;
          updateEntry(entry.id, { assetId });
        }
        try {
          await base44.entities.Asset.update(String(assetId), {
            title: entry.name, ...packageData,
            // Link de reprodução/download (o registro via /records não traz stream_url).
            file_url: `/api/v1/media/assets/${encodeURIComponent(assetId)}/stream`,
            ...(measured && !serverDuration ? { duration: measured, duration_source: 'browser' } : {}),
          });
        } catch (error) {
          throw new Error(`Arquivo enviado, mas os dados do pacote não foram gravados: ${error?.message || 'erro desconhecido'}. Tente de novo para regravar só os dados.`);
        }
      } else {
        if (entry.file.size > GENERIC_UPLOAD_LIMIT_BYTES) throw new Error('Documento maior que 100 MB, o limite de envio de documentos.');
        const uploaded = await uploadFile(entry.file, { onProgress });
        await base44.entities.Asset.create({
          title: entry.name, filename: entry.name, asset_type: entry.type,
          file_size: entry.file.size, file_url: uploaded.file_url, file_sha256: uploaded.sha256, ...packageData,
        });
      }
      updateEntry(entry.id, { status: 'uploaded', error: '' });
      setProgress((current) => ({ ...current, [entry.id]: 100 }));
      return true;
    } catch (error) {
      updateEntry(entry.id, { status: 'failed', error: error?.message || 'Falha no envio.' });
      return false;
    }
  }

  // Pacote da pasta de referência: o servidor copia cada arquivo para o destino e cria o Asset.
  // Retomar um pacote já criado continua dele em vez de criar outro.
  async function importFolderFiles() {
    try {
      const created = folderPackage || await createIngestPackage({
        name: name.trim() || `Pacote ${new Date().toLocaleString('pt-BR')}`,
        folder: folder.trim() || null, program_name: program || null, ai_enabled: aiEnabled, files: folderFiles,
      });
      setFolderPackage(created);
      const done = await runIngestPackage(created, { onUpdate: setFolderPackage });
      if (done.status === 'failed') {
        setFolderPackage(null);
        return `${done.failed_count} arquivo(s) da pasta não foram importados; veja em Ingest › Falhas e use "Reprocessar".`;
      }
      setFolderFiles([]);
      setFolderPackage(null);
      return '';
    } catch (error) {
      return `Importação da pasta interrompida: ${error?.message || 'erro desconhecido'}. Clique de novo para continuar.`;
    }
  }

  async function continueFlow() {
    if (step < 3) { setStep(step + 1); return; }
    if ((files.length === 0 && folderFiles.length === 0) || uploading) return;
    setUploading(true);
    setUploadError('');
    if (folderFiles.length) {
      const folderError = await importFolderFiles();
      if (folderError) {
        setUploading(false);
        setUploadError(folderError);
        return;
      }
    }
    let failures = 0;
    for (const entry of pendingUploadEntries(files)) {
      if (!(await uploadEntry(entry))) failures += 1;
    }
    setUploading(false);
    if (failures) {
      setUploadError(`${failures} arquivo(s) não foram enviados. Veja o motivo em cada linha e use "Tentar de novo"; os concluídos foram preservados.`);
      return;
    }
    navigate('/ingest');
  }

  async function retryEntry(entry) {
    if (uploading) return;
    setUploading(true);
    await uploadEntry(entry);
    setUploading(false);
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
                  <span className="text-xs font-semibold text-slate-300">Nome do pacote <span className="font-normal text-slate-500">(opcional)</span></span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sem nome — você poderá alterar depois"
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
            {!demoSession && (
              <div className="mb-3">
                <IngestFolderPicker selected={folderFiles} onChange={setFolderFiles} disabled={uploading} />
                {folderPackage && (
                  <div className="mt-2" aria-live="polite">
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>{folderPackage.status === 'processing' ? 'Copiando para a pasta de destino…' : `Transcrevendo com o Whisper local… (${folderPackage.transcription_pending} restante(s))`}</span>
                      <span className="font-bold text-sky-300">{folderPackage.progress}%</span>
                    </div>
                    <div role="progressbar" aria-label="Progresso da pasta de referência" aria-valuemin={0} aria-valuemax={100} aria-valuenow={folderPackage.progress} className="h-1.5 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-sky-500 transition-all" style={{ width: `${folderPackage.progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
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
                    <div key={f.id} className="group rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Icon size={15} className="text-slate-400" />
                        <span className="flex-1 text-sm text-slate-200">{f.name}</span>
                        <span className="text-xs text-slate-500">{f.size}</span>
                        <span className={`text-[10px] uppercase ${f.status === 'failed' ? 'text-rose-400' : f.status === 'uploaded' ? 'text-emerald-400' : 'text-sky-400'}`}>{f.status === 'uploaded' ? 'Enviado' : f.status === 'uploading' ? `Enviando ${progress[f.id] ?? 0}%` : f.status === 'failed' ? 'Falhou' : 'Pendente'}</span>
                        {f.status === 'failed' && <button type="button" onClick={() => retryEntry(f)} disabled={uploading} aria-label={`Tentar de novo ${f.name}`} className="rounded border border-rose-700 px-2 py-0.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-950/40 disabled:opacity-50">Tentar de novo</button>}
                        <button onClick={() => removeFile(f.id)} disabled={f.status === 'uploading'} aria-label={`Remover ${f.name}`} className="text-slate-600 hover:text-rose-400 disabled:opacity-40">✕</button>
                      </div>
                      {f.status === 'uploading' && <div role="progressbar" aria-label={`Progresso de ${f.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress[f.id] ?? 0} className="mt-1.5 h-1 overflow-hidden rounded bg-slate-800"><div className="h-full bg-sky-500 transition-all" style={{ width: `${progress[f.id] ?? 0}%` }} /></div>}
                      {f.status === 'failed' && f.error && <p className="mt-1 text-[11px] text-rose-300">{f.error}</p>}
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
          disabled={uploading || (step === 3 && files.length === 0 && folderFiles.length === 0)}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400"
        >
          {uploading ? 'Enviando…' : step === 3 ? uploadError ? 'Continuar envio' : 'Iniciar envio' : 'Criar pacote e continuar →'}
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
