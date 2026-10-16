import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Download, Shield, Save, Plus, Trash2, AlertTriangle, Settings2 } from 'lucide-react';
import { request } from '../../api/httpClient';
import { useAuth } from '../auth';

const box = 'rounded-xl border border-slate-800 bg-slate-900/60 p-4';
const input = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
const money = amount => amount == null ? 'Sem preço' : `US$ ${Number(amount).toFixed(5)}`;
const when = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
const blankPrice = () => ({ provider: 'compatible', model: '', input_per_million_usd: 0, output_per_million_usd: 0, per_image_usd: 0 });
const status = (v) => v === 'ok' ? 'text-emerald-300' : 'text-rose-300';

export default function AIUsageDashboard() {
  const { user } = useAuth();
  const allowed = ['admin','superadmin'].includes(String(user?.role || '').toLowerCase());
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState('');
  const [report, setReport] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const load = useCallback(async () => {
    if (!allowed) return;
    setBusy(true);setError('');
    try {
      const data = await request(`/ai/usage/report?days=${days}`);
      setReport(data);setPolicy(data.policy);
    } catch (e) { setError(e.message || 'Não foi possível carregar os registros.'); }
    finally { setBusy(false); }
  }, [allowed, days]);
  useEffect(() => { load(); }, [load]);
  async function save(e) {
    e.preventDefault();setSaving(true);setError('');setMessage('');
    try { await request('/ai/usage/policy',{method:'PUT',body:policy});setMessage('Configuração salva no servidor.');await load(); }
    catch(e){setError(e.message||'Não foi possível salvar.');}
    finally{setSaving(false);}
  }
  async function downloadCSV() {
    setError('');
    try {
      const origin = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${origin}/api/v1/ai/usage/export.csv?days=${days}`, {credentials:'include'});
      if(!response.ok) throw new Error(`Exportação indisponível (${response.status}).`);
      const blob = await response.blob();const url = URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='mediamind-ia-consumo.csv';a.click();URL.revokeObjectURL(url);
    }catch(e){setError(e.message);}
  }
  if(!allowed)return <div className={box}>Acesso restrito a administradores. A permissão também é validada no servidor.</div>;
  const t=report?.totals || {};
  const events=(report?.events||[]).filter(e=>[e.model,e.provider,e.feature,e.user,e.error_code,e.status].join(' ').toLowerCase().includes(filter.toLowerCase()));
  return <main className="w-full min-w-0 space-y-5 pb-12 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="text-sky-400"/> Dash de IAs</h1><p className="mt-1 text-sm text-slate-400">Telemetria persistida das rotas instrumentadas, por empresa. Custos são estimativas, não faturas.</p></div>
      <div className="flex flex-wrap items-center gap-2"><select aria-label="Período" className={input} value={days} onChange={e=>setDays(Number(e.target.value))}><option value={1}>Último dia</option><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={31}>31 dias</option></select><button className="rounded-lg border border-slate-700 px-3 py-2" onClick={load} disabled={busy}><RefreshCw size={16} className="inline"/> Atualizar</button><button className="rounded-lg border border-slate-700 px-3 py-2" onClick={downloadCSV}><Download size={16} className="inline"/> CSV</button><button className="rounded-lg border border-slate-700 px-3 py-2" onClick={()=>setSettingsOpen(v=>!v)}><Settings2 size={16} className="inline"/> Orçamento</button></div>
    </header>
    <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200"><AlertTriangle size={14} className="mr-1 inline"/> Contagem parcial: mede apenas chamadas de IA já instrumentadas. Uso direto dos provedores, outros módulos e histórico anterior não entram automaticamente. Valores dependem dos preços informados por você e podem divergir da fatura.</div>
    {busy&&<p className="text-sm text-slate-400">Atualizando dados…</p>}{error&&<p role="alert" className="rounded-lg bg-rose-950 p-3 text-rose-200">{error}</p>}{message&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-emerald-200">{message}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Chamadas registradas',t.calls||0],['Custo estimado conhecido',money(t.priced_usd||0)],['Erros / falhas',t.errors||0],['Chamadas sem preço',t.unpriced_calls||0],['Tokens de entrada',t.input_tokens||0],['Tokens de saída',t.output_tokens||0],['Imagens geradas',t.images||0],['Chamadas bem-sucedidas',t.ok||0]].map(([label,value])=><div key={label} className={box}><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></div>)}</div>
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">{[['Por modelo','models'],['Por usuário','users'],['Por funcionalidade','features'],['Por dia','days']].map(([title,key])=><section key={key} className={box}><h2 className="mb-3 font-semibold">{title}</h2><div className="max-h-72 space-y-2 overflow-y-auto">{!(report?.groups?.[key]||[]).length?<p className="text-xs text-slate-500">Sem registros neste período</p>:(report.groups[key]||[]).slice(0,30).map(row=><div key={row.name} className="border-b border-slate-800 pb-2 text-xs"><p className="break-words font-medium">{row.name}</p><div className="mt-1 flex justify-between text-slate-400"><span>{row.calls} chamada(s) · {row.errors} erro(s)</span><span>{money(row.cost_usd)}{row.unpriced?' + ?':''}</span></div></div>)}</div></section>)}</div>
    {settingsOpen&&policy&&<form onSubmit={save} className={`${box} space-y-4`}><h2 className="flex items-center gap-2 text-lg font-semibold"><Shield size={18}/> Limites e preços de referência</h2><p className="text-xs text-amber-200">Limites são pré-verificações, não reservas atômicas. Requisições simultâneas podem ultrapassar um teto. Preços devem ser fornecidos/atualizados pelo administrador.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/> Permitir chamadas de IA monitoradas</label><div className="grid gap-3 sm:grid-cols-3">{[['daily_limit_usd','Limite diário (US$)'],['monthly_limit_usd','Limite mensal (US$)'],['per_request_limit_usd','Limite por chamada (US$)']].map(([k,l])=><label key={k} className="text-xs">{l}<input type="number" min="0" step="0.001" className={input} value={policy[k]??0} onChange={e=>setPolicy({...policy,[k]:Number(e.target.value)})}/></label>)}</div><div className="flex items-center justify-between"><h3 className="font-medium">Tabela de preços dos modelos</h3><button type="button" onClick={()=>setPolicy({...policy,prices:[...policy.prices,blankPrice()]})} className="rounded-lg border border-slate-700 px-3 py-2 text-xs"><Plus size={14} className="inline"/> Modelo</button></div><p className="text-xs text-slate-400">Preencha entrada/saída por 1 milhão de tokens ou preço por imagem. Não há preços inventados como valores padrão.</p>{policy.prices.map((p,i)=><div key={i} className="grid gap-2 rounded-lg border border-slate-800 p-2 sm:grid-cols-6">{[['provider','Provedor'],['model','ID do modelo'],['input_per_million_usd','Entrada / milhão'],['output_per_million_usd','Saída / milhão'],['per_image_usd','Por imagem']].map(([k,l],j)=><label key={k} className={`text-[11px] ${j===1?'sm:col-span-2':''}`}>{l}<input required type={j<2?'text':'number'} min={j<2?undefined:0} step={j<2?undefined:'0.000001'} className={input} value={p[k]} onChange={e=>setPolicy({...policy,prices:policy.prices.map((x,n)=>n===i?{...x,[k]:j<2?e.target.value:Number(e.target.value)}:x)})}/></label>)}<button type="button" title="Remover preço" onClick={()=>setPolicy({...policy,prices:policy.prices.filter((_,n)=>n!==i)})}><Trash2 size={16} className="mx-auto text-rose-300"/></button></div>)}<button disabled={saving} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold"><Save size={15} className="mr-2 inline"/> Salvar no banco</button></form>}
    <section className={box}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Chamadas, falhas e latência</h2><input className={`${input} max-w-xs`} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtrar usuário, IA, erro ou área"/></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="border-b border-slate-700 text-slate-400">{['Data','Usuário','IA / modelo','Função','Status','Latência','Tokens E/S','Custo estimado','Erro'].map(h=><th className="px-2 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{events.map(row=><tr className="border-b border-slate-800" key={row.id}><td className="whitespace-nowrap px-2 py-2">{when(row.at)}</td><td className="px-2 py-2">{row.user}</td><td className="px-2 py-2">{row.provider} / {row.model}</td><td className="px-2 py-2">{row.feature}</td><td className={`px-2 py-2 ${status(row.status)}`}>{row.status}</td><td className="px-2 py-2 tabular-nums">{row.latency_ms} ms</td><td className="px-2 py-2 tabular-nums">{row.input_tokens} / {row.output_tokens}</td><td className="px-2 py-2">{money(row.cost_usd)}</td><td className="px-2 py-2 text-rose-300">{row.error_code||'—'}</td></tr>)}</tbody></table>{!events.length&&<p className="py-5 text-center text-xs text-slate-400">Nenhuma chamada registrada para o período e filtro escolhidos.</p>}</div></section>
    <section className={box}><h2 className="mb-2 font-semibold">Conexões configuradas no backend</h2><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(report?.connections?.connections||[]).map(c=><div key={c.id} className="rounded-lg border border-slate-800 p-3 text-xs"><p className="font-semibold">{c.name}</p><p className="text-slate-400">{c.provider} · {c.model}</p><p className={c.enabled&&c.key_configured?'text-emerald-300':'text-amber-300'}>{c.enabled?'Ativa':'Desativada'} · chave {c.key_configured?'cadastrada':'ausente'}</p></div>)}</div><a className="mt-3 inline-block text-xs text-sky-300 underline" href="/configuracoes/ia">Gerenciar conexões e funções de IA</a></section>
  </main>;
}
