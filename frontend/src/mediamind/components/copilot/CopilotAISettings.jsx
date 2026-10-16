import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Settings2, Trash2, X } from 'lucide-react';
import { useAuth } from '../../auth';

// Cadastro ADMINISTRATIVO LOCAL de modelos e sua atribuição a áreas do sistema.
// Credenciais e configurações reais de provedores DEVEM ficar no backend.
const KEY = 'mm_copilot_ai_registry_admin_v1';
const AREAS = [
  ['copilot','Copiloto / Planejamento'], ['transcription','Transcrição e decupagem'],
  ['search','Pesquisa inteligente / Acervo'], ['video','Geração de vídeo'],
  ['image','Imagem / Thumbnails'], ['clips','ClipsFree / Cortes'],
  ['editing','Edição / Timeline'], ['audio','Áudio / Voz'],
  ['agency','Agência de Vídeo / Comercial'], ['documents','Roteiros / Documentos'],
  ['moderation','Revisão / Auditoria'], ['analytics','Analytics / Relatórios'],
];
const field = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100';
const makeId = () => globalThis.crypto?.randomUUID?.() || `model-${Date.now()}-${Math.random()}`;
const blank = { provider: '', model: '', label: '', areas: [], enabled: false, notes: '' };
function readRegistry() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(value) ? value.filter(x => x && typeof x === 'object') : [];
  } catch { return []; }
}
export default function CopilotAISettings({ onClose }) {
  const { user } = useAuth();
  const permitted = ['admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());
  const [records, setRecords] = useState(readRegistry);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => records.filter(r =>
    `${r.label} ${r.provider} ${r.model} ${(r.areas || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())
  ), [records, query]);
  useEffect(() => {
    if (!permitted) return;
    try { localStorage.setItem(KEY, JSON.stringify(records)); setError(''); }
    catch { setError('Não foi possível salvar neste navegador.'); }
  }, [records, permitted]);
  if (!permitted) return null;
  const save = () => {
    const v = { ...editing, provider: editing.provider.trim(), model: editing.model.trim(), label: editing.label.trim(), notes: editing.notes.trim() };
    if (!v.provider || !v.model || !v.label) { setError('Informe provedor, identificador do modelo e nome visível.'); return; }
    if (records.some(r => r.id !== v.id && r.provider === v.provider && r.model === v.model)) { setError('Este modelo já consta no cadastro.'); return; }
    setRecords(list => v.id ? list.map(r => r.id === v.id ? v : r) : [...list, { ...v, id: makeId() }]);
    setEditing(null); setError('');
  };
  return <section aria-label="Configurações de IA" className="border-b border-slate-700 bg-slate-900/95 p-3 text-xs">
    <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1 font-semibold"><Settings2 size={14}/> Configurações de IA</div><button type="button" aria-label="Fechar configurações" onClick={onClose}><X size={16}/></button></div>
    <p className="mb-3 text-[11px] text-amber-200">Catálogo local de planejamento. Não identifica automaticamente provedores ativos, não altera o backend e não habilita chamadas de IA. Para uso em produção, exigir API administrativa com permissões verificadas no servidor.</p>
    <div className="mb-2 flex gap-2"><input aria-label="Filtrar modelos" placeholder="Buscar modelo, provedor ou área" className={field} value={query} onChange={e => setQuery(e.target.value)}/><button type="button" className="shrink-0 rounded bg-sky-800 px-2" onClick={()=>setEditing({ ...blank })}><Plus size={15}/></button></div>
    <div className="max-h-52 space-y-2 overflow-y-auto">
      {shown.length === 0 && <p className="rounded bg-slate-950 p-2 text-slate-400">Nenhum modelo cadastrado neste navegador. Cadastre um para mapear suas funções.</p>}
      {shown.map(r => <div className="rounded border border-slate-700 p-2" key={r.id}>
        <div className="flex items-start justify-between gap-1"><div className="min-w-0"><b className="break-words">{r.label}</b><p className="break-all text-slate-400">{r.provider} · {r.model}</p></div><span className={r.enabled ? 'text-emerald-300' : 'text-slate-400'}>{r.enabled ? 'Planejado ativo' : 'Desativado'}</span></div>
        <p className="mt-1 text-[11px] text-slate-300">{AREAS.filter(([id])=>r.areas?.includes(id)).map(([,name])=>name).join(' · ') || 'Nenhuma função atribuída'}</p>
        <div className="mt-2 flex gap-2"><button type="button" onClick={()=>setEditing({...r, areas:[...(r.areas||[])]})} className="rounded border border-slate-700 px-2 py-1">Editar</button><button type="button" onClick={()=>{if(window.confirm('Excluir este registro local do catálogo?'))setRecords(xs=>xs.filter(x=>x.id!==r.id))}} className="rounded border border-slate-700 px-2 py-1 text-rose-300"><Trash2 size={12}/></button></div>
      </div>)}
    </div>
    {editing && <div className="mt-3 space-y-2 rounded-lg border border-sky-800 bg-slate-950 p-2">
      <p className="font-semibold">{editing.id?'Editar cadastro':'Cadastrar IA'}</p>
      <label className="block">Nome visível<input className={field} value={editing.label} onChange={e=>setEditing({...editing,label:e.target.value})} placeholder="Ex.: Modelo para transcrição"/></label>
      <label className="block">Provedor<input className={field} value={editing.provider} onChange={e=>setEditing({...editing,provider:e.target.value})} placeholder="Ex.: OpenAI, Ollama, Google"/></label>
      <label className="block">Identificador do modelo<input className={field} value={editing.model} onChange={e=>setEditing({...editing,model:e.target.value})} placeholder="ID exato fornecido pelo provedor"/></label>
      <p className="font-semibold">Funcionalidades atribuídas</p>
      <div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto">{AREAS.map(([id,label])=><label key={id} className="flex items-start gap-2"><input type="checkbox" checked={editing.areas.includes(id)} onChange={e=>setEditing({...editing,areas:e.target.checked?[...editing.areas,id]:editing.areas.filter(a=>a!==id)})}/>{label}</label>)}</div>
      <label className="flex gap-2"><input type="checkbox" checked={editing.enabled} onChange={e=>setEditing({...editing,enabled:e.target.checked})}/> Marcar como habilitado no planejamento (não ativa API)</label>
      <label className="block">Observações<textarea rows={2} className={field} value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded border border-slate-700 px-3 py-1.5">Cancelar</button><button type="button" onClick={save} className="inline-flex items-center gap-1 rounded bg-sky-700 px-3 py-1.5"><Save size={12}/> Salvar cadastro</button></div>
    </div>}
    {error&&<p role="alert" className="mt-2 text-amber-200">{error}</p>}
    <p className="mt-3 text-[10px] text-slate-400">Nunca cadastre chaves API ou segredos aqui. O cadastro é local, por navegador, sem sincronização ou autorização no backend.</p>
  </section>;
}
