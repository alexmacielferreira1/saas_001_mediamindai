import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, X, ArrowRight, Building2, Search, Workflow, FolderOpen, AlertTriangle, Film, CheckCircle2, RotateCcw } from "lucide-react";
import VideoStudio from "../components/ai-tools/VideoStudio";
import AgencyMissionControl from "../components/agency/AgencyMissionControl";

// Agência: protótipo navegável isolado, com dados locais; nenhuma ação comercial é disparada.
const STORE_KEY = "mediamind_agencia_video_prototipo_v1";
const MODULES = [
  ["comando", "Central de Comando"], ["planejamento", "Planejamento"], ["radar", "Radar de Clientes"],
  ["prospeccao", "Prospecção"], ["crm", "CRM e Vendas"], ["campanhas", "Campanhas e Produtos"],
  ["projetos", "Projetos"], ["geracao", "Geração de Vídeo"], ["edicao", "Produção e Edição"],
  ["aprovacao", "Aprovação e Entrega"], ["publicacao", "Publicação"], ["financeiro", "Financeiro"],
  ["clientes", "Clientes e Pós-venda"], ["agentes", "Agentes IA"],
];
const initial = { leads: [], opportunities: [], campaigns: [], projects: [], tasks: [], activity: [] };
const colors = "rounded-lg border border-slate-800 bg-slate-900/70";
const inputStyle = "min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500";
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (parsed && typeof parsed === "object") return Object.fromEntries(Object.keys(initial).map((k) => [k, Array.isArray(parsed[k]) ? parsed[k] : []]));
  } catch { /* armazenamento indisponível ou malformado */ }
  return initial;
}
const newId = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function Form({ fields, onSave, buttonLabel = "Adicionar" }) {
  const [values, setValues] = useState({});
  return <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
    event.preventDefault();
    if (!String(values[fields[0][0]] || "").trim()) return;
    onSave(values); setValues({});
  }}>
    {fields.map(([id, label, options]) => <label key={id} className="flex min-w-[155px] flex-1 flex-col gap-1 text-xs text-slate-400">{label}
      {options ? <select className={inputStyle} value={values[id] || options[0]} onChange={(e) => setValues({ ...values, [id]: e.target.value })}>{options.map((option) => <option key={option}>{option}</option>)}</select> :
        <input className={inputStyle} value={values[id] || ""} onChange={(e) => setValues({ ...values, [id]: e.target.value })} placeholder={label} />}
    </label>)}
    <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500"><Plus size={14}/>{buttonLabel}</button>
  </form>;
}
function Panel({ title, description, children, footer }) {
  return <section className={`${colors} p-4 space-y-3`}><div><h2 className="text-base font-semibold text-white">{title}</h2>{description && <p className="text-xs text-slate-400">{description}</p>}</div>{children}{footer && <div className="text-xs text-slate-500">{footer}</div>}</section>;
}
function Rows({ data, render }) {
  return data.length ? <div className="divide-y divide-slate-800">{data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-200">{render(item)}</div>)}</div> : <p className="rounded-md bg-slate-950/60 p-4 text-sm text-slate-500">Nenhum registro. Crie o primeiro para testar o fluxo.</p>;
}
function Metric({ label, value }) { return <div className={`${colors} p-4`}><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>; }
export default function AgenciaVideo({ embedded = false }) {
  const [params, setParams] = useSearchParams();
  const active = MODULES.some(m => m[0] === params.get("guia")) ? params.get("guia") : "comando";
  const [data, setData] = useState(load);
  const [query, setQuery] = useState("");
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* quota / privado */ } }, [data]);
  const go = (id) => setParams((old) => { const p = new URLSearchParams(old); p.set("guia", id); return p; });
  const mutate = (fn, label) => setData((prev) => { const next = fn(prev); return { ...next, activity: [{ id:newId(), label, at:new Date().toLocaleString("pt-BR") }, ...prev.activity].slice(0,40) }; });
  const add = (type, values, description) => mutate((prev) => ({ ...prev, [type]: [{ ...values, id:newId(), createdAt: new Date().toISOString() }, ...prev[type]] }), description);
  const update = (type, id, changes, description) => mutate((prev) => ({ ...prev, [type]: prev[type].map((x) => x.id === id ? { ...x, ...changes } : x) }), description);
  const qualified = data.leads.filter((x) => x.status === "Qualificado");
  const money = useMemo(() => data.opportunities.filter(x => x.status === "Ganha").reduce((acc, x) => acc + (Number(x.valor) || 0), 0), [data.opportunities]);
  const list = (rows) => rows.filter((x) => Object.values(x).some((v) => String(v || "").toLowerCase().includes(query.toLowerCase())));
  const navButton = (id, title) => <button type="button" onClick={() => go(id)} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">{title}<ArrowRight size={13}/></button>;
  return <main className="space-y-3 text-slate-100" aria-label={embedded ? "VIDEO_ESTUDIO" : "Agência de Vídeo"}>
    <header className={`${colors} flex flex-wrap items-center justify-between gap-3 px-3 py-2`}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-sm font-bold tracking-wide">{embedded ? "VIDEO_ESTUDIO" : "AGÊNCIA DE VÍDEO"}</h1>
        <span className="text-xs text-slate-400">Operação comercial e criativa · protótipo supervisionado</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-amber-800 bg-amber-950/30 px-2 py-1 text-xs text-amber-300">Validação · dados locais</span>
        {!embedded && <Link to="/geracao-de-video" className="text-xs text-cyan-300 underline">Abrir Geração de Vídeo</Link>}
      </div>
    </header>
    <nav className="flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-1.5" role="tablist" aria-label="Guias da agência">
      {MODULES.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => go(id)} className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${active === id ? "bg-cyan-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{label}</button>)}
    </nav>
    <div className="flex min-w-0 items-start gap-3">
      <div className="min-w-0 flex-1">
    {active === "geracao" ? <section role="tabpanel"><div className={`${colors} mb-3 flex items-center justify-between gap-2 p-3 text-xs text-slate-400`}><span>A mesma ferramenta utilizada no VIDEO_ESTUDIO, sem duplicar o código.</span><Link className="text-cyan-300 underline" to="/geracao-de-video">Abrir página isolada</Link></div><VideoStudio /></section> : <section role="tabpanel" className="space-y-3">
      {active === "comando" && <><AgencyMissionControl compact /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Leads cadastrados" value={data.leads.length}/><Metric label="Oportunidades" value={data.opportunities.length}/><Metric label="Campanhas-base" value={data.campaigns.length}/><Metric label="Projetos" value={data.projects.length}/></div><div className="grid gap-3 lg:grid-cols-2"><Panel title="Próximas ações" description="Fluxo de trabalho para a validação das telas"><div className="grid gap-2">{[["radar","Cadastrar leads"],["crm","Criar oportunidades"],["campanhas","Preparar uma campanha-base"],["projetos","Abrir projeto de produção"]].map(([id,label]) => <button key={id} onClick={() => go(id)} className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-left text-sm hover:bg-slate-800">{label}<ArrowRight size={15}/></button>)}</div></Panel><Panel title="Atividade recente"><Rows data={data.activity.slice(0,8)} render={(item) => <><span>{item.label}</span><small className="text-slate-500">{item.at}</small></>}/></Panel></div></>}
      {active === "planejamento" && <><Panel title="Planejamento semanal" description="Cadastre decisões, orçamento e próximos passos. Sem execução automática."><Form fields={[["nome","Tarefa ou objetivo"],["responsavel","Responsável"],["prazo","Prazo ou referência"]]} buttonLabel="Criar tarefa" onSave={(v)=>add("tasks",{...v,status:"Pendente"},`Planejamento: ${v.nome}`)}/><Rows data={data.tasks} render={(x)=><><div><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.responsavel} · {x.prazo}</p></div><select className={inputStyle} value={x.status} onChange={(e)=>update("tasks",x.id,{status:e.target.value},`Tarefa ${x.nome}: ${e.target.value}`)}><option>Pendente</option><option>Em andamento</option><option>Concluída</option></select></>}/></Panel></>}
      {active === "radar" && <Panel title="Radar de Clientes" description="Cadastro manual para testar a qualificação; pesquisa web automática ainda não está conectada."><Form fields={[["nome","Empresa"],["segmento","Nicho"],["cidade","Cidade / região"],["contato","Contato público informado"]]} onSave={(v)=>add("leads",{...v,status:"Novo"},`Lead criado: ${v.nome}`)}/><input className={`${inputStyle} w-full`} placeholder="Filtrar empresas, cidades ou nichos" value={query} onChange={(e)=>setQuery(e.target.value)}/><Rows data={list(data.leads)} render={(x)=><><div className="min-w-[180px]"><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.segmento} · {x.cidade}</p></div><div className="flex items-center gap-2"><select className={inputStyle} value={x.status} onChange={(e)=>update("leads",x.id,{status:e.target.value},`Lead ${x.nome}: ${e.target.value}`)}><option>Novo</option><option>Em análise</option><option>Qualificado</option><option>Descartado</option></select><button type="button" className="text-xs text-cyan-300" onClick={()=>go("crm")}>CRM <ArrowRight size={13} className="inline"/></button></div></>}/></Panel>}
      {active === "prospeccao" && <Panel title="Fila de Prospecção" description="Prepare oportunidades, mas nenhum contato será enviado automaticamente."><p className="text-sm text-slate-400">Leads qualificados disponíveis: <strong className="text-white">{qualified.length}</strong></p><Rows data={qualified} render={(x)=><><div><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.segmento} · {x.contato || "Contato não informado"}</p></div><button type="button" className="text-xs text-cyan-300" onClick={()=>go("crm")}>Abrir no CRM <ArrowRight size={13} className="inline"/></button></>}/><p className="text-xs text-amber-300">Mensagens, ligações e redes sociais só serão habilitadas com integrações e regras de autorização.</p></Panel>}
      {active === "crm" && <Panel title="CRM e Vendas" description="Oportunidades vinculadas a leads; registros locais para validar os estágios."><Form fields={[["nome","Nome da oportunidade"],["leadId","Empresa",data.leads.map(x=>x.nome).length ? data.leads.map(x=>x.nome) : ["Sem empresa cadastrada"]],["valor","Valor previsto (R$)"]]} buttonLabel="Nova oportunidade" onSave={(v)=>add("opportunities",{...v,status:"Nova"},`Oportunidade criada: ${v.nome}`)}/><Rows data={data.opportunities} render={(x)=><><div><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.leadId} · R$ {Number(x.valor || 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div><select className={inputStyle} value={x.status} onChange={(e)=>update("opportunities",x.id,{status:e.target.value},`Negócio ${x.nome}: ${e.target.value}`)}>{["Nova","Qualificada","Proposta","Negociação","Ganha","Perdida"].map(s=><option key={s}>{s}</option>)}</select></>}/></Panel>}
      {active === "campanhas" && <Panel title="Biblioteca comercial e campanhas-base" description="Conceitos reutilizáveis separados da marca de clientes e de licenças de uso."><Form fields={[["nome","Nome da campanha"],["nicho","Nicho"],["conceito","Conceito criativo"],["licenca","Tipo de licença",["Não exclusiva","Exclusividade por território","Exclusiva"]]]} onSave={(v)=>add("campaigns",{...v,status:"Rascunho"},`Campanha criada: ${v.nome}`)}/><Rows data={data.campaigns} render={(x)=><><div><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.nicho} · {x.conceito}</p></div><span className="text-xs text-cyan-300">{x.licenca} · {x.status}</span></>}/><p className="text-xs text-amber-300">Bloqueio real de exclusividade territorial requer banco, contratos e validação de conflitos.</p></Panel>}
      {active === "projetos" && <Panel title="Gestor de Projetos" description="Projetos vinculáveis a campanhas e a clientes. Esta versão armazena somente os registros de navegação."><Form fields={[["nome","Nome do projeto"],["cliente","Cliente / empresa"],["campanha","Campanha-base",data.campaigns.length ? data.campaigns.map(x=>x.nome) : ["Projeto avulso"]]]} onSave={(v)=>add("projects",{...v,status:"Planejamento"},`Projeto criado: ${v.nome}`)}/><Rows data={data.projects} render={(x)=><><div><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.cliente} · {x.campanha}</p></div><div className="flex gap-2"><select className={inputStyle} value={x.status} onChange={(e)=>update("projects",x.id,{status:e.target.value},`Projeto ${x.nome}: ${e.target.value}`)}>{["Planejamento","Produção","Em revisão","Aprovado","Entregue"].map(s=><option key={s}>{s}</option>)}</select>{navButton("geracao","Gerar vídeo")}</div></>}/></Panel>}
      {active === "edicao" && <Panel title="Produção e Edição" description="Visão dos projetos em produção e acesso à ferramenta existente."><Rows data={data.projects.filter(x=>x.status !== "Entregue")} render={(x)=><><span>{x.nome} · {x.status}</span>{navButton("geracao","Ir para geração")}</>}/><p className="text-xs text-slate-500">Timeline avançada e exportação dependerão da integração com os módulos atuais de edição do MediaMindAI.</p></Panel>}
      {active === "aprovacao" && <Panel title="Aprovação e Entrega" description="Visão dos estados de revisão, sem simular aprovações externas."><Rows data={data.projects.filter(x=>["Em revisão","Aprovado","Entregue"].includes(x.status))} render={(x)=><><strong>{x.nome}</strong><span className="text-xs text-cyan-300">{x.status}</span></>}/><p className="text-xs text-amber-300">Comentários com timecode e envio ao cliente serão ligados ao fluxo de aprovação existente posteriormente.</p></Panel>}
      {active === "publicacao" && <Panel title="Publicação" description="Preparação editorial para os projetos; nenhuma postagem automática."><Rows data={data.projects.filter(x=>["Aprovado","Entregue"].includes(x.status))} render={(x)=><><strong>{x.nome}</strong><span className="text-xs text-slate-400">Pronto para preparar formatos e textos</span></>}/><p className="text-xs text-slate-500">Futura integração: títulos, descrições, thumbnails, redes, autorizações e agendamento.</p></Panel>}
      {active === "financeiro" && <><div className="grid grid-cols-2 gap-3"><Metric label="Valor de negócios ganhos (não recebido)" value={`R$ ${money.toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/><Metric label="Pagamentos conciliados" value="Sem integração"/></div><Panel title="Financeiro da operação" description="Nenhum valor aqui representa saldo bancário, cobrança enviada ou receita liquidada."><Rows data={data.opportunities.filter(x=>x.status === "Ganha")} render={(x)=><><strong>{x.nome}</strong><span>R$ {Number(x.valor || 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></>}/></Panel></>}
      {active === "clientes" && <Panel title="Clientes e Pós-venda" description="Leads e clientes serão unificados no CRM definitivo sem perder o histórico."><Rows data={data.leads} render={(x)=><><div><strong>{x.nome}</strong><p className="text-xs text-slate-500">{x.segmento} · {x.cidade}</p></div><span className="text-xs text-slate-400">{x.status}</span></>}/></Panel>}
      {active === "agentes" && <AgencyMissionControl />}
    </section>}
      </div>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Protótipo local no navegador; não compartilha dados entre dispositivos nem integra o banco do MediaMindAI.</span><button type="button" className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200" onClick={()=>{if(window.confirm("Apagar todos os registros de teste da agência neste navegador?")){setData({leads:[],opportunities:[],campaigns:[],projects:[],tasks:[],activity:[]});setQuery("");}}}><RotateCcw size={13}/>Limpar testes</button></footer>
  </main>;
}
