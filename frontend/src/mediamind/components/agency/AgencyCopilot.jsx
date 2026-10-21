import React, { useEffect, useMemo, useState } from "react";
import { Bot, Lightbulb, MessageSquare, History, X, ArrowRight } from "lucide-react";

// Copiloto V1: conversa e histórico LOCAL. Nenhuma IA/API é chamada; nenhuma mensagem externa é enviada.
const KEY = "mediamind_agencia_copiloto_v1";
const MAX_EVENTS = 150;
const readState = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && typeof v === "object") return v; } catch { /* privado */ }
  return { conversation: [], events: [], selected: null };
};
const makeId = () => globalThis.crypto?.randomUUID?.() || `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const button = "rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800";
const stamp = () => new Date().toLocaleString("pt-BR");

export default function AgencyCopilot({ activeModule, moduleLabel, data, go, onClose }) {
  const [tab, setTab] = useState("sugestoes");
  const [state, setState] = useState(readState);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [contextMode, setContextMode] = useState("pagina");
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* limite do navegador */ } }, [state]);
  const register = (event) => setState(prev => ({...prev, events: [{ id: makeId(), at: stamp(), ...event }, ...(prev.events || [])].slice(0, MAX_EVENTS)}));
  const focus = (record) => {
    const context = { id: record.id, title: record.title, description: record.description || record.detail || "", module: record.module || activeModule, status: record.status || "Referência" };
    setState(prev => ({...prev, selected: context, conversation:[...(prev.conversation || []), {id:makeId(), role:"system", content:`Contexto vinculado: ${context.title}. ${context.description}`, at:stamp()}]}));
    setTab("executar");
  };
  const suggestions = useMemo(() => {
    const result = [];
    if (!(data.leads || []).length) result.push({id:"radar-init",title:"Começar a pesquisa de clientes",description:"Definir nicho, território, oferta e orçamento antes de criar uma missão.",module:"radar"});
    if ((data.leads || []).some(x=>x.status === "Novo")) result.push({id:"leads",title:"Qualificar leads novos",description:`${data.leads.filter(x=>x.status === "Novo").length} registro(s) aguardando classificação.`,module:"radar"});
    if ((data.opportunities || []).some(x=>x.status === "Proposta")) result.push({id:"proposals",title:"Revisar propostas",description:"Há oportunidades na etapa Proposta. Confira prazos e condições.",module:"crm"});
    if (!(data.campaigns || []).length) result.push({id:"campaigns",title:"Planejar a primeira campanha-base",description:"Criar um conceito reutilizável sem associar material exclusivo a um cliente.",module:"campanhas"});
    if ((data.projects || []).some(x=>x.status === "Em revisão")) result.push({id:"review",title:"Conferir projetos em revisão",description:"Existem projetos que podem exigir aprovação ou ajustes.",module:"aprovacao"});
    if (!result.length) result.push({id:"routine",title:"Revisar a operação da agência",description:"Confira compromissos, orçamento e próximos passos para esta semana.",module:"comando"});
    return result;
  },[data]);
  const history = useMemo(() => [
    ...(state.events || []).map(x=>({...x,origin:"copiloto"})),
    ...(data.activity || []).map(x=>({id:`agency-${x.id}`,title:x.label,detail:"Atividade registrada no protótipo local da Agência.",status:"Registro",module:"agencia",at:x.at,origin:"agencia"}))
  ],[state.events, data.activity]);
  const filtered = history.filter(x=> filter === "Todos" || x.status === filter);
  const submit = (e) => {
    e.preventDefault(); if(!message.trim())return;
    const text = message.trim(); const ctx = state.selected;
    const log = {id:makeId(),title:"Comando preparado",detail:text,status:"Pendente",module:ctx?.module || activeModule,at:stamp(),context:ctx};
    setState(prev=>({...prev, conversation:[...(prev.conversation || []),{id:makeId(),role:"user",content:text,at:stamp()},{id:makeId(),role:"assistant",content:"Registrei este pedido como comando pendente. Nesta V1 não há modelo de IA nem execução automática. Você pode abrir a guia relacionada e realizar a alteração manualmente; a integração real de ferramentas virá na próxima fase.",at:stamp()}],events:[log,...(prev.events || [])].slice(0,MAX_EVENTS)}));
    setMessage("");
  };
  return <div className="border border-slate-700 bg-slate-900 text-slate-100 rounded-lg p-3 space-y-3">
    <header className="flex items-center gap-2"><Bot size={19} className="text-cyan-400"/><div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Copiloto da Agência</h2><p className="text-[11px] text-amber-300">V1 local • IA desconectada</p></div><button onClick={onClose} className={button} title="Recolher Copiloto"><X size={14}/></button></header>
    <nav className="grid grid-cols-3 gap-1" aria-label="Áreas do Copiloto">{[["sugestoes","Sugestões",Lightbulb],["executar","Executar",MessageSquare],["executado","Executado",History]].map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`rounded-md px-1 py-2 text-[11px] flex flex-col items-center gap-1 ${tab===id?"bg-cyan-700 text-white":"bg-slate-800 text-slate-300"}`}><Icon size={15}/>{label}</button>)}</nav>
    <div className="rounded-md border border-slate-700 p-2 text-xs"><div className="text-slate-400 text-[11px]">Página atual</div><div className="flex gap-2 items-center"><span className="flex-1">{moduleLabel || activeModule}</span><button className="text-cyan-300" onClick={()=>{setContextMode(contextMode==="pagina"?"fixo":"pagina")}} title="Alternar contexto automático">{contextMode==="pagina"?"Automático":"Manual"}</button></div>{state.selected && <div className="flex items-center gap-1 mt-2 border-t border-slate-700 pt-2"><span className="flex-1 text-cyan-200 truncate">{state.selected.title}</span><button onClick={()=>setState(p=>({...p,selected:null}))} title="Desvincular"><X size={13}/></button></div>}</div>
    {tab==="sugestoes" && <div className="space-y-2"><p className="text-xs text-slate-400">Sugestões por regras locais, baseadas nos registros de teste. Não são análises de IA.</p>{suggestions.map(x=><article key={x.id} className="rounded-md border border-slate-700 p-2 space-y-1"><p className="text-sm font-semibold">{x.title}</p><p className="text-xs text-slate-400">{x.description}</p><div className="flex justify-between gap-1"><button onClick={()=>go(x.module)} className={button}>Abrir guia</button><button onClick={()=>focus(x)} className={button}>Conversar <ArrowRight size={11} className="inline"/></button></div></article>)}</div>}
    {tab==="executar" && <div className="space-y-2"><div className="h-64 overflow-y-auto rounded-md bg-slate-950 p-2 space-y-2" aria-live="polite">{!(state.conversation || []).length && <p className="text-xs text-slate-400">Digite um objetivo ou selecione um item de Sugestões / Executado para vincular o contexto. Pedidos são registrados, mas não executados automaticamente.</p>}{(state.conversation || []).map(x=><div key={x.id} className={`text-xs p-2 rounded-md ${x.role==="user"?"bg-cyan-900/50 ml-5":x.role==="system"?"border border-cyan-800 text-cyan-200":"bg-slate-800 mr-4"}`}>{x.content}</div>)}</div><form onSubmit={submit} className="space-y-2"><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 p-2 text-sm" placeholder="Converse sobre uma tarefa ou descreva uma alteração..."/><button type="submit" disabled={!message.trim()} className="w-full rounded-md bg-cyan-700 p-2 text-xs font-semibold disabled:opacity-40">Registrar comando</button></form><p className="text-[11px] text-amber-300">Sem execução real: ações devem ser realizadas nas guias até a integração ao backend.</p></div>}
    {tab==="executado" && <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">Histórico e pendências</span><select value={filter} onChange={e=>setFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 text-xs">{["Todos","Pendente","Concluído","Erro","Registro"].map(x=><option key={x}>{x}</option>)}</select></div>{!filtered.length && <p className="text-xs text-slate-500">Nenhum evento nesse filtro.</p>}{filtered.slice(0,60).map(x=><article key={x.id} className="rounded-md border border-slate-700 p-2 space-y-1"><div className="flex gap-2 items-start"><p className="flex-1 text-xs font-semibold">{x.title}</p><span className="text-[10px] text-slate-400">{x.status}</span></div><p className="text-[11px] text-slate-400 line-clamp-3">{x.detail}</p><p className="text-[10px] text-slate-500">{x.at}</p><div className="flex justify-end"><button className={button} onClick={()=>focus({id:x.id,title:x.title,detail:x.detail,module:x.module,status:x.status})}>Conversar e corrigir <ArrowRight size={11} className="inline"/></button></div></article>)}<p className="text-[11px] text-slate-500">Histórico local deste navegador, não auditoria do backend.</p></div>}
  </div>;
}
