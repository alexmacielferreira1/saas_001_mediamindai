import React, { useState } from 'react';
import { Scissors, Plus, User, Calendar, FileText, Send, Download, FileCode2, Copy, RotateCcw, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useProducaoProjetos, addProjeto, updateProjeto, setEtapa, moverEtapa, transicionar } from '../../../lib/producaoStore';
import { baixarXmlPremiere } from '../../../lib/premiereXml';
import { useAuth } from '../../../auth';
import { StageDragArea, DraggableStageCard } from '../StageDragList';

const EDICAO_STATUS = [
  { value: 'rascunho_corte', label: 'Rascunho de corte' },
  { value: 'corte_fino', label: 'Corte fino' },
  { value: 'revisao_interna', label: 'Revisão interna' },
  { value: 'pronto_para_aprovacao', label: 'Pronto p/ aprovação' },
];
const STATUS_LABEL = { rascunho_corte: 'Rascunho de corte', corte_fino: 'Corte fino', revisao_interna: 'Revisão interna', pronto_para_aprovacao: 'Pronto p/ aprovação' };

function inputCls() {
  return 'w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500';
}

// Em edição: lista (arrastável) + detalhamento + acesso às mídias (download,
// copiar nomes, baixar XML Premiere) + ajuste ao videomaker / revisão do produtor.
export default function EdicaoPage({ disableBack = false }) {
  const projetos = useProducaoProjetos();
  const { user } = useAuth();
  const { toast } = useToast();
  const editorName = user?.name || 'Editor';
  const emEdicao = projetos.filter((p) => p.etapa === 'em_edicao');
  const [selId, setSelId] = useState(emEdicao[0]?.id ?? null);
  const sel = emEdicao.find((p) => p.id === selId) || emEdicao[0] || null;
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteObs, setAjusteObs] = useState('');

  function nova() {
    const id = addProjeto({ etapa: 'em_edicao', programa: '', titulo: 'Nova edição', apresentadores: [], editor: editorName, responsavel: editorName });
    setSelId(id);
  }
  function field(name, value) { if (sel) updateProjeto(sel.id, { [name]: value }); }

  function copiarNomes() {
    const nomes = (sel.materiais || []).map((m) => m.nome).join('\n');
    if (!nomes) return;
    navigator.clipboard.writeText(nomes).then(() => toast({ title: 'Nomes dos arquivos copiados' }));
  }

  function enviarAjuste() {
    if (!ajusteObs.trim()) return;
    updateProjeto(sel.id, { grav_status: 'problema' });
    transicionar(sel.id, 'gravacao', { quem: editorName, obs: `Ajuste solicitado pela edição: ${ajusteObs.trim()}` });
    setAjusteOpen(false);
    setAjusteObs('');
    toast({ title: 'Ajuste solicitado ao videomaker', description: 'O projeto voltou pra Gravação com a observação.' });
  }

  function pedirRevisaoProdutor() {
    updateProjeto(sel.id, { revisao_intermediaria: true });
    transicionar(sel.id, 'em_aprovacao', { quem: editorName, obs: 'Revisão intermediária do produtor solicitada' });
    toast({ title: 'Revisão do produtor solicitada', description: 'O projeto foi pra Em aprovação (revisão intermediária).' });
  }

  const materiais = sel?.materiais || [];

  return (
    <div className="grid h-full gap-4 lg:grid-cols-5">
      {/* Lista */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300"><Scissors size={14} className="text-sky-400" /> Em edição</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{emEdicao.length} projeto(s) em edição</p>
          </div>
          <button onClick={nova} className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Nova</button>
        </div>
        <StageDragArea onMove={moverEtapa} disableBack={disableBack} className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto p-3">
            {emEdicao.length === 0 ? (
              <p className="px-3 py-10 text-center text-[11px] text-slate-500">{disableBack ? 'Nada em edição. Crie uma nova edição pra começar.' : 'Nada em edição. Arraste um projeto da Gravação pra cá, ou crie uma nova edição.'}</p>
            ) : (
              <div className="space-y-2">
                {emEdicao.map((p) => {
                  const st = STATUS_LABEL[p.edicao_status] || 'Rascunho de corte';
                  return (
                    <DraggableStageCard key={p.id} id={p.id} etapa={p.etapa} onClick={() => setSelId(p.id)} className={`w-full rounded-lg border p-3 text-left transition ${selId === p.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase text-sky-400">{p.episodio || '—'} · {p.programa}</p>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-violet-500/15 text-violet-300">{st}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-200">{p.titulo}</p>
                      <p className="mt-1 text-[10px] text-slate-500">resp. {p.editor || p.responsavel || '—'}</p>
                    </DraggableStageCard>
                  );
                })}
              </div>
            )}
          </div>
        </StageDragArea>
      </div>

      {/* Detalhamento de edição */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-3">
        {sel ? (
          <>
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{sel.episodio || '—'} · {sel.programa}</p>
              <h2 className="text-sm font-semibold text-slate-100">{sel.titulo}</h2>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Título</span>
                  <input value={sel.titulo || ''} onChange={(e) => field('titulo', e.target.value)} className={inputCls()} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Programa</span>
                  <input value={sel.programa || ''} onChange={(e) => field('programa', e.target.value)} className={inputCls()} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Episódio</span>
                  <input value={sel.episodio || ''} onChange={(e) => field('episodio', e.target.value)} className={inputCls()} />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-0.5 flex items-center gap-1 text-[9px] uppercase text-slate-500"><User size={10} /> Responsável pela edição</span>
                  <input value={sel.editor || sel.responsavel || ''} onChange={(e) => field('editor', e.target.value)} className={inputCls()} placeholder="Editor" />
                </label>
                <label className="block">
                  <span className="mb-0.5 flex items-center gap-1 text-[9px] uppercase text-slate-500"><Calendar size={10} /> Prazo de edição</span>
                  <input type="date" value={sel.edicao_prazo || ''} onChange={(e) => field('edicao_prazo', e.target.value)} className={inputCls()} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Status da edição</span>
                  <select value={sel.edicao_status || 'rascunho_corte'} onChange={(e) => field('edicao_status', e.target.value)} className={inputCls()}>
                    {EDICAO_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>

              {/* Mídias — download, copiar nomes, XML Premiere */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><FileCode2 size={11} /> Mídias da gravação ({materiais.length})</p>
                  {materiais.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={copiarNomes} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800" title="Copiar nomes dos arquivos pra colar no Premiere">
                        <Copy size={11} /> Copiar nomes
                      </button>
                      <button onClick={() => baixarXmlPremiere(sel)} className="flex items-center gap-1 rounded-md border border-violet-700/50 px-2 py-1 text-[10px] font-semibold text-violet-300 hover:bg-violet-950/40" title="Baixar projeto Premiere (XML) com os clipes">
                        <FileCode2 size={11} /> Baixar XML Premiere
                      </button>
                    </div>
                  )}
                </div>
                {materiais.length === 0 ? (
                  <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 text-[11px] text-slate-500">Sem mídias recebidas. O videomaker precisa subir os arquivos na aba Gravações.</p>
                ) : (
                  <div className="space-y-1.5">
                    {materiais.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <FileText size={13} className="shrink-0 text-violet-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">{m.nome}</p>
                          <p className="text-[10px] text-slate-500">{m.tamanho}</p>
                        </div>
                        <a href={m.url} download={m.nome} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300" title="Baixar mídia">
                          <Download size={13} />
                        </a>
                      </div>
                    ))}
                    <p className="pt-1 text-[10px] text-slate-500">Baixe as mídias pra uma pasta local, abra o Premiere e conecte a pasta — ou importe o XML Premiere com os clipes já referenciados.</p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><FileText size={11} /> Observações de edição</p>
                <textarea value={sel.edicao_obs || ''} onChange={(e) => field('edicao_obs', e.target.value)} rows={3} className={inputCls()} placeholder="Cortes, observações de cor, áudio, assets vinculados..." />
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">Resumo da produção</p>
                <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
                  <p>Pauta: {sel.pauta || '—'}</p>
                  <p>Equipe: {(sel.equipe || []).join(', ') || '—'}</p>
                  <p>Gravação: {sel.gravacao ? `${sel.gravacao.data} · ${sel.gravacao.horario} · ${sel.gravacao.estudio}` : '—'}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-3">
              <button onClick={() => setAjusteOpen(true)} className="flex items-center gap-1.5 rounded-md border border-rose-700/50 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-950/40">
                <RotateCcw size={12} /> Solicitar ajuste ao videomaker
              </button>
              <button onClick={pedirRevisaoProdutor} className="flex items-center gap-1.5 rounded-md border border-amber-700/50 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-950/40">
                <MessageSquare size={12} /> Pedir revisão do produtor
              </button>
              <button onClick={() => setEtapa(sel.id, 'em_aprovacao')} className="ml-auto flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400">
                <Send size={12} /> Enviar pra aprovação
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Selecione um projeto na lista para ver o detalhamento da edição.
          </div>
        )}
      </div>

      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100"><RotateCcw size={16} className="text-rose-400" /> Solicitar ajuste ao videomaker</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400">Descreva o ajuste. O projeto volta pra Gravação com essa observação e o videomaker é avisado.</p>
          <textarea value={ajusteObs} onChange={(e) => setAjusteObs(e.target.value)} rows={3} placeholder="Ex.: regravar a abertura, áudio do convidado baixo, cortar o trecho final..." className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAjusteOpen(false)} className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">Cancelar</button>
            <button onClick={enviarAjuste} disabled={!ajusteObs.trim()} className="rounded-md bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-rose-400 disabled:opacity-50">Enviar ajuste</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}