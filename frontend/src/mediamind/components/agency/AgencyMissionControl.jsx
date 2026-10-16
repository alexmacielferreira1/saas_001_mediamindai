import React, { useEffect, useMemo, useState } from "react";
import { Bot, Play, Pause, ShieldAlert, Plus, RotateCcw } from "lucide-react";

// Protótipo de orquestração: não consulta a web, não envia contatos, não consome APIs.
// Quando houver backend, substituir este repositório por endpoints auditáveis.
const STORE = "mediamind_agency_missions_v1";
const STEPS = {
  pesquisa: ["Definir fontes autorizadas", "Pesquisar leads", "Qualificar com evidências", "Solicitar revisão de resultados"],
  campanha: ["Definir conceito e licenças", "Preparar roteiro-base", "Produzir amostra", "Submeter campanha para revisão"],
  venda: ["Verificar elegibilidade do contato", "Preparar abordagem", "Submeter mensagem para aprovação", "Registrar resultado no CRM"],
  producao: ["Validar briefing e pedido", "Preparar plano de ativos", "Gerar e revisar mídias", "Solicitar aprovação e entrega"],
  operacao: ["Conferir pedidos e prazos", "Revisar propostas", "Analisar custos e pendências", "Apresentar plano de trabalho"],
};
const TYPES = [
  ["operacao", "Revisar a operação"], ["pesquisa", "Pesquisar oportunidades"], ["campanha", "Criar campanha conceitual"],
  ["venda", "Preparar prospecção"], ["producao", "Planejar produção"]
];
const AGENTS = [
  ["Supervisor", "Organiza tarefas, dependências e prioridades"],
  ["Radar", "Pesquisa fontes autorizadas e registra evidências"],
  ["Qualificador", "Analisa adequação das oportunidades"],
  ["Comercial", "Elabora ofertas e acompanha respostas"],
  ["Roteirista", "Prepara narrativas e roteiros"],
  ["Produtor", "Coordena ativos, vídeos e formatos"],
  ["Revisor", "Verifica qualidade e requisitos"],
  ["Financeiro", "Aponta custos e cobranças pendentes"],
  ["Auditor", "Registra execuções e exceções"]
];
const box = "rounded-lg border border-slate-800 bg-slate-900/70";
const field = "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500";
const button = "rounded-md px-3 py-2 text-xs font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
const uid = () => globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || "null");
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m === "object" && Array.isArray(m.steps)) : [];
  } catch { return []; }
}
function createMission(form) {
  const steps = STEPS[form.type] || STEPS.operacao;
  return {
    id: uid(), title: form.title.trim(), type: form.type, niche: form.niche.trim(), region: form.region.trim(),
    objective: form.objective.trim(), budget: Number(form.budget) || 0, used: 0,
    state: "rascunho", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    steps: steps.map((name, index) => ({ id: uid(), name, state: index === 0 ? "pronta" : "bloqueada" })),
    log: [{ at: new Date().toISOString(), label: "Missão criada como plano local; nenhuma ação de IA executada." }],
  };
}
function transition(mission, action) {
  const log = (label, patch) => ({ ...mission, ...patch, updatedAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), label }, ...(mission.log || [])].slice(0, 80) });
  if (action === "start" && ["rascunho", "pausada"].includes(mission.state)) return log("Missão iniciada em modo de planejamento manual.", { state: "em_planejamento" });
  if (action === "pause" && ["em_planejamento", "aguardando_aprovacao"].includes(mission.state)) return log("Missão pausada.", { state: "pausada" });
  if (action === "reset") return log("Etapas reiniciadas, preservando o histórico.", { state: "rascunho", steps: mission.steps.map((s, i) => ({ ...s, state: i === 0 ? "pronta" : "bloqueada" })) });
  if (action === "complete_step" && mission.state === "em_planejamento") {
    const index = mission.steps.findIndex(s => s.state === "pronta");
    if (index < 0) return mission;
    const next = mission.steps.map((s, i) => ({ ...s, state: i === index ? "concluida" : i === index + 1 ? "pronta" : s.state }));
    const finished = index === mission.steps.length - 1;
    return log(`${mission.steps[index].name} — confirmado manualmente${finished ? "; revisão final pendente" : ""}.`, { steps: next, state: finished ? "aguardando_aprovacao" : "em_planejamento" });
  }
  if (action === "approve" && mission.state === "aguardando_aprovacao") return log("Plano revisado e aprovado por administrador; nenhuma ação externa foi enviada.", { state: "aprovada" });
  if (action === "reject" && mission.state === "aguardando_aprovacao") return log("Revisão solicitada; plano devolvido ao planejamento.", { state: "pausada" });
  return mission;
}
const status = { rascunho: "Rascunho", em_planejamento: "Em planejamento", pausada: "Pausada", aguardando_aprovacao: "Aguardando aprovação", aprovada: "Plano aprovado" };
function Summary({ missions }) {
  const pending = missions.filter(m => m.state === "aguardando_aprovacao").length;
  const ongoing = missions.filter(m => m.state === "em_planejamento").length;
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
    {[["Missões cadastradas", missions.length], ["Em planejamento", ongoing], ["Sua aprovação", pending], ["APIs gastas", "R$ 0,00"]].map(([label, value]) =>
      <div key={label} className={`${box} p-3`}><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-xl font-bold text-white">{value}</div></div>)}
  </div>;
}
export default function AgencyMissionControl({ compact = false }) {
  const [missions, setMissions] = useState(load);
  const [newOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState("todas");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", type: "pesquisa", niche: "", region: "", objective: "", budget: "0" });
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(missions)); } catch { /* modo privado ou quota */ } }, [missions]);
  const displayed = useMemo(() => missions.filter(m => filter === "todas" || (filter === "aprovacoes" ? m.state === "aguardando_aprovacao" : m.state === filter)), [missions, filter]);
  const change = (id, action) => setMissions(prev => prev.map(m => m.id === id ? transition(m, action) : m));
  const activeMission = missions.find(m => m.id === selected);
  const set = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
  return <div className="space-y-3">
    <section className={`${box} p-3 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-white"><Bot size={18} className="text-cyan-400" /> Central de Missões</h2><p className="text-xs text-slate-400">Dê o comando, revise as etapas e acompanhe as decisões sem perder o controle.</p></div><button type="button" className={`${button} bg-cyan-600 text-white inline-flex items-center gap-1`} onClick={() => setNewOpen(v => !v)}><Plus size={14}/> Nova missão</button></div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-md border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-amber-300">Modo protótipo — nenhuma IA conectada</span><span className="rounded-md border border-slate-700 px-2 py-1 text-slate-400">Sem contatos automáticos</span><span className="rounded-md border border-slate-700 px-2 py-1 text-slate-400">Sem consumo de créditos</span></div>
      <Summary missions={missions}/>
      {newOpen && <form className="grid grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3 md:grid-cols-2" onSubmit={e => {e.preventDefault(); if (!form.title.trim()) return; const m = createMission(form); setMissions(p=>[m,...p]); setSelected(m.id); setNewOpen(false); setForm({ title: "", type: "pesquisa", niche: "", region: "", objective: "", budget: "0" });}}>
        <label className="text-xs text-slate-400">Nome da missão<input required maxLength={120} value={form.title} onChange={e=>set("title",e.target.value)} className={field} placeholder="Ex.: Encontrar oportunidades no setor pet"/></label>
        <label className="text-xs text-slate-400">Tipo de operação<select className={field} value={form.type} onChange={e=>set("type",e.target.value)}>{TYPES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-xs text-slate-400">Nicho ou segmento<input className={field} value={form.niche} onChange={e=>set("niche",e.target.value)} placeholder="Ex.: pet shops"/></label>
        <label className="text-xs text-slate-400">Cidade / território<input className={field} value={form.region} onChange={e=>set("region",e.target.value)} placeholder="Ex.: Porto Alegre"/></label>
        <label className="text-xs text-slate-400 md:col-span-2">Comando / objetivo<textarea className={`${field} min-h-20`} value={form.objective} onChange={e=>set("objective",e.target.value)} placeholder="Descreva o que a agência deve organizar. Somente o planejamento será salvo nesta versão."/></label>
        <label className="text-xs text-slate-400">Teto de gasto autorizado (R$) — reservado para integração futura<input type="number" min="0" step="0.01" className={field} value={form.budget} onChange={e=>set("budget",e.target.value)} /></label>
        <div className="flex items-end justify-end gap-2"><button type="button" className={`${button} border border-slate-700 text-slate-300`} onClick={()=>setNewOpen(false)}>Cancelar</button><button type="submit" className={`${button} bg-cyan-600 text-white`}>Criar plano</button></div>
      </form>}
    </section>
    <section className={`${box} p-3 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">Fila de missões</h3><select aria-label="Filtrar missões" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs" value={filter} onChange={e=>setFilter(e.target.value)}><option value="todas">Todas</option><option value="aprovacoes">Precisam de aprovação</option><option value="em_planejamento">Em planejamento</option><option value="pausada">Pausadas</option><option value="aprovada">Planos aprovados</option></select></div>
      {!displayed.length && <div className="rounded-lg bg-slate-950 p-4 text-sm text-slate-400">Nenhuma missão nesse filtro. Crie uma missão para planejar o trabalho dos agentes.</div>}
      {displayed.map(m=><div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="text-left text-sm font-semibold text-white hover:text-cyan-300" onClick={()=>setSelected(selected===m.id?null:m.id)}>{m.title}</button><span className={`text-xs ${m.state==="aguardando_aprovacao"?"text-amber-300":m.state==="aprovada"?"text-emerald-300":"text-slate-400"}`}>{status[m.state]||m.state}</span></div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500"><span>{TYPES.find(t=>t[0]===m.type)?.[1]}</span><span>· {m.niche||"Sem nicho"}</span><span>· {m.region||"Sem território"}</span><span>· Teto R$ {m.budget.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
        <div className="flex gap-1">{m.steps.map((s,i)=><div key={s.id} title={`${i+1}. ${s.name} — ${s.state}`} className={`h-1.5 flex-1 rounded-full ${s.state==="concluida"?"bg-emerald-500":s.state==="pronta"?"bg-cyan-500":"bg-slate-700"}`}/>)}</div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setSelected(selected===m.id?null:m.id)} className={`${button} border border-slate-700 text-slate-200`}>Detalhes e histórico</button>{["rascunho","pausada"].includes(m.state)&&<button type="button" onClick={()=>change(m.id,"start")} className={`${button} bg-cyan-700 text-white inline-flex items-center gap-1`}><Play size={12}/>Iniciar planejamento</button>}{m.state==="em_planejamento"&&<button type="button" onClick={()=>change(m.id,"pause")} className={`${button} border border-slate-700 text-slate-300`}><Pause size={12} className="inline"/> Pausar</button>}{m.state==="aguardando_aprovacao"&&<><button type="button" onClick={()=>change(m.id,"approve")} className={`${button} bg-emerald-700 text-white`}>Aprovar plano</button><button type="button" onClick={()=>change(m.id,"reject")} className={`${button} border border-amber-800 text-amber-300`}>Pedir revisão</button></>}</div>
        {selected===m.id && <div className="space-y-3 border-t border-slate-800 pt-3"><p className="whitespace-pre-wrap text-sm text-slate-300">{m.objective || "Nenhuma descrição adicional."}</p><ol className="space-y-2">{m.steps.map((s,i)=><li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-900 p-2 text-xs"><span className="text-slate-200">{i+1}. {s.name}</span><span className="flex items-center gap-2"><span className="text-slate-500">{s.state}</span>{s.state==="pronta"&&m.state==="em_planejamento"&&<button type="button" className={`${button} bg-slate-700 text-slate-100`} onClick={()=>change(m.id,"complete_step")}>Marcar realizada</button>}</span></li>)}</ol><div className="text-xs text-amber-300">Etapas são confirmadas manualmente. Marcar uma etapa não significa que o agente executou a tarefa.</div><div className="space-y-1"><strong className="text-xs text-slate-300">Histórico</strong>{(m.log||[]).slice(0,8).map((l,i)=><p key={i} className="text-xs text-slate-500">{new Date(l.at).toLocaleString("pt-BR")}: {l.label}</p>)}</div>{m.state==="aprovada"&&<button type="button" className={`${button} border border-slate-700 text-slate-300`} onClick={()=>change(m.id,"reset")}><RotateCcw size={12} className="inline"/> Reabrir planejamento</button>}</div>}
      </div>)}
    </section>
    {!compact && <section className={`${box} p-3`}><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldAlert size={16} className="text-amber-400"/> Permissões dos agentes</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{AGENTS.map(([name,detail])=><div key={name} className="rounded-md border border-slate-800 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-white">{name}</strong><span className="text-[11px] text-slate-500">Desconectado</span></div><p className="mt-1 text-xs text-slate-400">{detail}</p></div>)}</div><p className="mt-3 text-xs text-amber-300">Esta tela não executa IA, pesquisa, disparos, cobranças ou operações financeiras. Somente planos, revisão e histórico local.</p></section>}
  </div>;
}
