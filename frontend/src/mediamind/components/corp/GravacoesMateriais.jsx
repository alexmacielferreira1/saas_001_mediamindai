import React, { useState } from 'react';
import { Upload, FileVideo, Trash2, Eye, Clapperboard, AlertTriangle, Settings2, UserPlus, Hand, CheckCircle2, Database, CalendarDays, MapPin, Clock3, FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useProducaoProjetos, updateProjeto, transicionar } from '../../lib/producaoStore';
import { useModoTransicao, setModoTransicao, TRANSITION_MODES } from '../../lib/producaoConfig';
import { useAuth } from '../../auth';
import { uploadRecordingFiles } from '../../lib/gravacoesUpload';
import { isProjectInProductionStage } from '../../lib/productionWorkflow';

// Gravações (Produção): o videomaker vê a gravação atribuída, marca o status
// (agendada → gravando → gravada), sobe os arquivos gravados (drag-and-drop/ingest)
// e sinaliza problema/regravação. A transição pra Em edição segue o modo da empresa:
// editor puxa (padrão), auto-avança ao subir material, ou produtor designa editor.
const GRAV_STATUS = {
  agendada: { label: 'Agendada', tone: 'bg-sky-500/15 text-sky-300' },
  gravando: { label: 'Gravando', tone: 'bg-amber-500/15 text-amber-300' },
  gravada: { label: 'Gravada', tone: 'bg-emerald-500/15 text-emerald-300' },
  problema: { label: 'Problema', tone: 'bg-rose-500/15 text-rose-300' },
};

export default function GravacoesMateriais() {
  const projetos = useProducaoProjetos();
  const modo = useModoTransicao();
  const { user } = useAuth();
  const { toast } = useToast();
  const editorName = user?.name || 'Editor';

  const lista = projetos.filter((p) => isProjectInProductionStage(p, 'gravacoes'));
  const [selectedId, setSelectedId] = useState(lista[0]?.id ?? null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [problemaOpen, setProblemaOpen] = useState(false);
  const [problemaObs, setProblemaObs] = useState('');
  const [editorDesignado, setEditorDesignado] = useState('');
  const rec = lista.find((p) => p.id === selectedId) || lista[0];

  if (!rec) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
        Nenhuma gravação em andamento. Agende e designe um videomaker em
        <span className="font-semibold text-slate-300">&nbsp;Agendamentos&nbsp;</span>.
      </div>
    );
  }

  const materiais = rec.materiais || [];
  const st = GRAV_STATUS[rec.grav_status] || GRAV_STATUS.agendada;
  const podeEnviar = materiais.length > 0 && rec.grav_status === 'gravada';

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length || !rec) return;
    setUploading(true);
    try {
      const { uploaded: novos, failed } = await uploadRecordingFiles(
        files,
        (file) => base44.integrations.Core.UploadPublicFile({ file }),
      );
      const jaTem = (rec.materiais || []).length > 0;
      if (novos.length) updateProjeto(rec.id, { materiais: [...(rec.materiais || []), ...novos] });
      if (failed.length) {
        toast({
          title: `${failed.length} arquivo(s) não enviado(s)`,
          description: `Os arquivos confirmados foram preservados. Revise: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`,
          variant: 'destructive',
        });
      }
      // Auto-avanço: ao subir o primeiro material, o projeto entra na fila Para editar.
      if (modo === 'auto_avanca' && !jaTem && novos.length && !failed.length && isProjectInProductionStage(rec, 'gravacoes')) {
        transicionar(rec.id, 'para_editar', { quem: editorName, obs: 'Auto-avanço ao subir material' });
        toast({ title: 'Material recebido — projeto para editar', description: `${rec.titulo} avançou automaticamente.` });
      }
    } finally {
      setUploading(false);
    }
  }

  function removerMaterial(mid) {
    updateProjeto(rec.id, { materiais: materiais.filter((m) => m.id !== mid) });
  }

  function enviarEdicao() {
    if (modo === 'editor_puxa') {
      transicionar(rec.id, 'para_editar', { quem: editorName, obs: 'Editor puxou pra fila de edição' });
      updateProjeto(rec.id, { editor: editorName });
    } else if (modo === 'produtor_designa') {
      if (!editorDesignado) return;
      transicionar(rec.id, 'para_editar', { quem: editorDesignado, obs: 'Produtor designou editor' });
      updateProjeto(rec.id, { editor: editorDesignado });
    }
    const next = lista.find((p) => p.id !== rec.id);
    setSelectedId(next?.id ?? null);
  }

  function registrarProblema() {
    if (!problemaObs.trim()) return;
    updateProjeto(rec.id, { grav_status: 'problema' });
    transicionar(rec.id, 'gravacoes', { quem: editorName, obs: `Problema/regravação: ${problemaObs.trim()}` });
    setProblemaOpen(false);
    setProblemaObs('');
    toast({ title: 'Problema sinalizado', description: 'O produtor/videomaker foi avisado da regravação.' });
  }

  return (
    <div className="grid h-full overflow-hidden border border-slate-800 bg-slate-950/35 lg:grid-cols-[minmax(320px,38%)_1fr]">
      {/* Gravações em andamento */}
      <div className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950/20 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Produção / Captação</p><p className="text-sm font-semibold text-slate-100">Gravações em andamento</p><p className="text-[10px] text-slate-500">{lista.length} produções no fluxo</p></div>
          <label className="flex items-center gap-1 text-[10px] text-slate-500" title="Modo de transição pra Em edição">
            <Settings2 size={11} />
            <select value={modo} onChange={(e) => setModoTransicao(e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px] text-slate-200 outline-none">
              {TRANSITION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex-1 divide-y divide-slate-800 overflow-y-auto">
          {lista.map((r) => {
            const n = (r.materiais || []).length;
            const rs = GRAV_STATUS[r.grav_status] || GRAV_STATUS.agendada;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${r.id === rec.id ? 'border-l-sky-400 bg-sky-950/35' : 'border-l-transparent bg-transparent hover:bg-slate-900/60'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase text-sky-400">{r.episodio || '—'} · {r.programa}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${rs.tone}`}>{rs.label}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-200">{r.titulo}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span>{r.gravacao?.data || '—'} · {r.gravacao?.estudio || '—'}</span>
                  {r.videomaker && <span>· 🎥 {r.videomaker}</span>}
                  <span className={`rounded px-1.5 py-0.5 ${n > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/40 text-slate-400'}`}>{n > 0 ? `${n} material` : 'sem material'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe: status + receber materiais + envio pra edição */}
      <div className="flex min-h-0 flex-col bg-slate-900/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{rec.episodio || '—'} · {rec.programa}</p>
            <h2 className="truncate text-sm font-semibold text-slate-100">{rec.titulo}</h2>
          </div>
          <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${st.tone}`}>{st.label}</span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-6 border-y border-slate-800 py-3">{['Confirmada','Em gravação','Gravada','Mídias enviadas','Processando','Concluída'].map((label,index)=><div key={label} className="relative text-center"><div className={`mx-auto grid size-5 place-items-center rounded-full text-[9px] font-bold ${index===0?'bg-sky-500 text-slate-950':index<3?'border border-sky-500 text-sky-300':'bg-slate-800 text-slate-500'}`}>{index===0?<CheckCircle2 size={12}/>:index+1}</div><p className="mt-1 text-[8px] text-slate-500">{label}</p></div>)}</div>

          <div className="grid gap-3 xl:grid-cols-[1fr_.9fr]"><section className="rounded-lg border border-slate-800 bg-slate-950/35 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase text-slate-500">Informações da gravação</p><button className="text-[9px] text-sky-400">Editar</button></div><div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[10px]"><span className="flex items-center gap-1 text-slate-500"><CalendarDays size={11}/>Data</span><b className="text-slate-300">{rec.gravacao?.data||'—'}</b><span className="flex items-center gap-1 text-slate-500"><Clock3 size={11}/>Horário</span><b className="text-slate-300">{rec.gravacao?.horario||'—'}</b><span className="flex items-center gap-1 text-slate-500"><MapPin size={11}/>Estúdio</span><b className="text-slate-300">{rec.gravacao?.estudio||'—'}</b><span className="text-slate-500">Videomaker</span><b className="text-slate-300">{rec.videomaker||rec.responsavel||'A definir'}</b><span className="text-slate-500">Equipe básica</span><b className="text-slate-300">{(rec.equipe||[]).join(', ')||'—'}</b></div></section>
          {/* Status da gravação */}
          <section className="rounded-lg border border-slate-800 bg-slate-950/35 p-3"><p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Ações da sessão</p><div className="grid gap-2 sm:grid-cols-2">
            {rec.grav_status !== 'gravando' && rec.grav_status !== 'gravada' && (
              <button onClick={() => updateProjeto(rec.id, { grav_status: 'gravando' })} className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-500">
                <Clapperboard size={12} /> Iniciar gravação
              </button>
            )}
            {rec.grav_status !== 'gravada' && (
              <button onClick={() => updateProjeto(rec.id, { grav_status: 'gravada', gravada: true })} className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400">
                <Clapperboard size={12} /> Registrar gravação concluída
              </button>
            )}
            <button onClick={() => setProblemaOpen(true)} className="flex items-center gap-1.5 rounded-md border border-rose-700/50 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-950/40">
              <AlertTriangle size={12} /> Sinalizar problema/regravação
            </button>
          </div></section></div>

          {/* Upload */}
          <div className="grid gap-3 xl:grid-cols-[1.4fr_.6fr]"><div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`flex w-full flex-col items-center justify-center gap-2 border border-dashed py-7 text-center transition-colors ${dragOver ? 'border-sky-500 bg-sky-950/30 text-sky-200' : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-sky-600 hover:text-sky-300'}`}
          >
            <Upload size={22} className={uploading ? 'animate-pulse' : ''} />
            <span className="text-xs font-semibold">{uploading ? 'Enviando arquivos…' : 'Arraste os arquivos gravados aqui'}</span>
            <span className="text-[10px] text-slate-500">ou</span>
            <div className="flex flex-wrap justify-center gap-2">
              <label className="cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-800">
                <span className="flex items-center gap-1.5"><Upload size={12} /> Ingest de arquivos</span>
                <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>
              <label className="cursor-pointer rounded-md border border-sky-700/70 bg-sky-950/40 px-3 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-900/50">
                <span className="flex items-center gap-1.5"><FolderOpen size={12} /> Selecionar pasta da gravação</span>
                <input type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>
            </div>
            <span className="max-w-xl text-[9px] leading-4 text-slate-600">Ao apontar uma pasta, todos os arquivos e subpastas são preparados para o ingest, mantendo a organização original.</span>
          </div><aside className="rounded-lg border border-sky-900/70 bg-sky-950/20 p-3"><div className="flex gap-2"><Database size={20} className="text-sky-400"/><div><p className="text-xs font-bold text-slate-200">Envio privado ao servidor</p><p className="mt-1 text-[9px] leading-4 text-slate-500">Somente arquivos confirmados pela API aparecem como recebidos. O limite atual é 100 MB por arquivo. Pacote Ingest, proxy, IA e arquivos maiores ainda dependem de implementação.</p></div></div><div className="mt-3 space-y-1 text-[9px] text-slate-400">{['Validação do tipo','Limite por arquivo','Checksum no servidor','Aviso de falhas sem falso sucesso'].map((item)=><p key={item} className="flex items-center gap-1"><CheckCircle2 size={10} className="text-sky-400"/>{item}</p>)}</div></aside></div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Materiais recebidos ({materiais.length})</p>
            {materiais.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-6 text-center text-xs text-slate-500">Nenhum material recebido ainda.</p>
            ) : (
              <div className="space-y-2">
                {materiais.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <FileVideo size={14} className="shrink-0 text-violet-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">{m.nome}</p>
                      <p className="truncate text-[10px] text-slate-500">{m.caminhoRelativo || m.nome} · {m.tamanho} · recebido {m.recebido}</p>
                    </div>
                    <button onClick={() => setPreview(m)} className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-sky-300" title="Ver material">
                      <Eye size={13} />
                    </button>
                    <button onClick={() => removerMaterial(m.id)} className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300" title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Envio pra Em edição — varia com o modo configurado */}
        <div className="border-t border-slate-800 px-4 py-3">
          {modo === 'editor_puxa' && (
            <button onClick={enviarEdicao} disabled={!podeEnviar} className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
              <Hand size={12} /> Puxar pra editar (atribui a você)
            </button>
          )}
          {modo === 'auto_avanca' && (
            <p className="text-[11px] text-slate-400">Ao subir o primeiro material, o projeto avança sozinho pra <span className="font-semibold text-slate-200">Em edição</span>.</p>
          )}
          {modo === 'produtor_designa' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1">
                <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Designar editor</span>
                <input value={editorDesignado} onChange={(e) => setEditorDesignado(e.target.value)} placeholder="Nome do editor" className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
              </label>
              <button onClick={enviarEdicao} disabled={!podeEnviar || !editorDesignado} className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
                <UserPlus size={12} /> Designar e enviar pra edição
              </button>
            </div>
          )}
          {!podeEnviar && modo !== 'auto_avanca' && <p className="mt-1 text-[10px] text-slate-500">Registre a gravação como concluída e receba ao menos um material antes de enviar.</p>}
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100">{preview?.nome}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border border-slate-700 bg-black">
            {preview?.url ? <video controls src={preview.url} className="w-full" /> : <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-slate-500">Prévia indisponível: este material ainda não possui arquivo local vinculado.</div>}
          </div>
          <p className="text-xs text-slate-400">{preview?.tamanho} · recebido {preview?.recebido}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={problemaOpen} onOpenChange={setProblemaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100"><AlertTriangle size={16} className="text-rose-400" /> Sinalizar problema / regravação</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400">Descreva o problema. O projeto volta pra Gravação e o produtor/videomaker é avisado.</p>
          <textarea value={problemaObs} onChange={(e) => setProblemaObs(e.target.value)} rows={3} placeholder="Ex.: áudio com ruído, câmera 2 fora de foco, precisa regravar a entrevista..." className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setProblemaOpen(false)} className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">Cancelar</button>
            <button onClick={registrarProblema} disabled={!problemaObs.trim()} className="rounded-md bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-rose-400 disabled:opacity-50">Sinalizar</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
