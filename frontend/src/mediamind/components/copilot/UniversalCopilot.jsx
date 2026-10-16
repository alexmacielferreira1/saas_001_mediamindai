import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, ChevronRight, Plus, Play, ListPlus, MessageSquare, History, Lightbulb,  Wrench, ExternalLink, X, FolderOpen, Paperclip, Settings2, ChevronDown, MonitorPlay } from 'lucide-react';
import { createMCPQueue, listMCPTools } from '../../lib/mcpApi';

// Catálogo visual: operações só executam se o backend anunciar ferramenta disponível.
// Catálogo contextual extensível: cada tela/subguia recebe comandos adequados.
// Sem executor real: a ação fica explicitamente pendente; nunca simula resultado.
const GROUPS = {
 dashboard: { label:'Início e indicadores',module:'ai-tools',cards:['Resumir pendências','Localizar tarefas atrasadas','Abrir projetos recentes','Conferir aprovações','Organizar prioridades','Preparar relatório'] },
 ingest: {label:'Ingestão',module:'ai-tools',cards:['Selecionar mídias','Verificar formato','Identificar duplicados','Transcrever arquivos','Organizar metadados','Iniciar processamento']},
 search: {label:'Pesquisa e acervo',module:'ai-tools',cards:['Pesquisar por descrição','Filtrar por período','Encontrar trechos','Comparar versões','Classificar mídias','Preparar seleção']},
 workspace: {label:'Workspace audiovisual',module:'mmfilm',cards:['Selecionar timeline','Adicionar mídia','Marcar IN / OUT','Organizar sequência','Sincronizar áudio','Exportar seleção']},
 script: {label:'Roteiros e rascunhos',module:'ai-tools',cards:['Criar roteiro','Resumir briefing','Revisar texto','Gerar pauta','Vincular mídias','Enviar para edição']},
 recording: {label:'Gravações',module:'mmfilm',cards:['Preparar gravação','Selecionar programa','Conferir mídias','Criar marcadores','Transcrever gravação','Enviar para edição']},
 edit: {label:'Edição e timeline',module:'mmfilm',cards:['Ler timeline','Cortar trechos (IN / OUT)','Criar legendas automáticas','Ajustar áudio e normalização','Ajustar cor e exposição','Preparar exportação']},
 review: {label:'Revisão e aprovação',module:'mmfilm',cards:['Abrir versão','Marcar comentário no tempo','Comparar versões','Solicitar ajuste','Preparar aprovação','Encaminhar correção']},
 publication: {label:'Publicação',module:'ai-tools',cards:['Preparar legenda','Criar título','Adaptar formato','Conferir miniatura','Montar calendário','Preparar publicação']},
 analytics: {label:'Analytics',module:'ai-tools',cards:['Filtrar resultados','Comparar períodos','Analisar desempenho','Criar relatório','Localizar oportunidades','Exportar dados']},
 video: {label:'Geração de vídeo',module:'ai-tools',cards:['Sugerir roteiro','Criar storyboard','Gerar imagem','Gerar vídeo','Montar cenas','Preparar exportação']},
 clips: {label:'ClipsFree',module:'mmfilm',cards:['Transcrever vídeo','Detectar melhores trechos','Marcar IN / OUT','Gerar legendas','Reenquadrar corte','Exportar cortes']},
 image: {label:'Arte e thumbnails',module:'mmphoto',cards:['Recortar pessoa','Remover fundo','Aplicar identidade visual','Inserir título','Criar variações','Exportar arte']},
 graphics: {label:'Ferramentas gráficas',module:'mmphoto',cards:['Abrir prancheta','Selecionar camadas','Remover fundo','Aplicar efeito','Ajustar cores','Exportar composição']},
 audio: {label:'Áudio',module:'mmsom',cards:['Limpar ruído','Normalizar loudness','Equalizar','Sincronizar trilhas','Masterizar','Exportar áudio']},
 office: {label:'Documentos e produtividade',module:'ai-tools',cards:['Gerar documento','Resumir conteúdo','Revisar texto','Organizar dados','Gerar gráficos','Exportar resultado']},
 admin: {label:'Administração',module:'ai-tools',cards:['Pesquisar usuários','Conferir permissões','Revisar atividades','Analisar falhas','Gerar auditoria','Preparar relatório']},
 agency_command: {label:'Agência · Comando',module:'ai-tools',cards:['Planejar a semana','Revisar missões','Conferir pendências','Consultar indicadores','Distribuir tarefas','Preparar decisão']},
 agency_planning: {label:'Agência · Planejamento',module:'ai-tools',cards:['Definir nicho','Escolher território','Definir orçamento','Criar missão','Planejar calendário','Revisar metas']},
 agency_radar: {label:'Agência · Radar',module:'ai-tools',cards:['Pesquisar empresas','Qualificar lead','Verificar duplicatas','Analisar presença digital','Encontrar campanha compatível','Preparar prospecção']},
 agency_prospect: {label:'Agência · Prospecção',module:'ai-tools',cards:['Preparar mensagem','Conferir elegibilidade','Revisar abordagem','Registrar retorno','Organizar follow-up','Encaminhar para CRM']},
 agency_crm: {label:'Agência · CRM',module:'ai-tools',cards:['Criar oportunidade','Consultar cliente','Atualizar etapa','Preparar proposta','Registrar contato','Analisar negociação']},
 agency_campaign: {label:'Agência · Campanhas',module:'ai-tools',cards:['Criar conceito','Pesquisar campanhas','Vincular mídias','Verificar exclusividade','Adaptar identidade','Gerar proposta']},
 agency_project: {label:'Agência · Projetos',module:'ai-tools',cards:['Criar projeto','Selecionar entregáveis','Atualizar briefing','Organizar produção','Conferir prazos','Preparar revisão']},
 agency_production: {label:'Agência · Produção',module:'mmfilm',cards:['Selecionar projeto','Abrir timeline','Adicionar mídia','Gerar cortes','Criar legenda','Preparar exportação']},
 agency_approval: {label:'Agência · Aprovação',module:'ai-tools',cards:['Conferir entregáveis','Abrir revisão','Solicitar ajustes','Preparar pacote','Registrar aceite','Preparar entrega']},
 agency_finance: {label:'Agência · Financeiro',module:'ai-tools',cards:['Consultar pagamentos','Conferir cobrança','Revisar custos','Verificar conciliação','Preparar relatório','Sinalizar pendências']},
 agency_client: {label:'Agência · Clientes',module:'ai-tools',cards:['Abrir cliente','Consultar histórico','Revisar entregas','Preparar suporte','Registrar feedback','Sugerir oferta']},
 agency_agents: {label:'Agência · Agentes',module:'ai-tools',cards:['Criar missão','Consultar fila','Conferir falhas','Pausar tarefa','Revisar permissões','Ver execuções']},
};
const AGENCY_GUIDES={comando:'agency_command',planejamento:'agency_planning',radar:'agency_radar',prospeccao:'agency_prospect',crm:'agency_crm',campanhas:'agency_campaign',projetos:'agency_project',geracao:'video',edicao:'agency_production',aprovacao:'agency_approval',publicacao:'publication',financeiro:'agency_finance',clientes:'agency_client',agentes:'agency_agents'};
const detectGroup=(location)=>{
 const path=location.pathname.toLowerCase();
 const q=new URLSearchParams(location.search);
 const sub=(q.get('sub')||'').toLowerCase();
 const tab=(q.get('tab')||'').toLowerCase();
 const tool=(q.get('tool')||'').toLowerCase();
 if(path.includes('agencia-video'))return AGENCY_GUIDES[q.get('guia')]||'agency_command';
 if(path.includes('administration'))return 'admin';
 if(path.includes('thumb')||path.includes('estudio-de-arte'))return 'image';
 if(path.includes('ferramentas-graficas'))return 'graphics';
 if(path.includes('clipsfree'))return 'clips';
 if(path.includes('geracao-de-video')||path.includes('video-estudio'))return 'video';
 if(path.includes('ferramentas-ia'))return 'video';
 if(tool.includes('som')||tool.includes('audition'))return 'audio';
 if(/word|excel|powerpoint/.test(tool))return 'office';
 if(/photo|vector/.test(tool))return 'graphics';
 if(/film|effect|premiere|fusion|color/.test(tool))return 'edit';
 if(path==='/corp'){
  if(sub==='ingest')return 'ingest';
  if(sub==='pesquisa')return 'search';
  if(sub==='workspace')return 'workspace';
  if(sub==='rascunhos')return 'script';
  if(sub==='gravacoes'||sub==='agendamentos')return 'recording';
  if(['em_edicao','para_editar'].includes(sub))return 'edit';
  if(['aguardando_aprovacao','em_aprovacao','finalizado'].includes(sub))return 'review';
  if(['redes_sociais','para_publicar','publicado'].includes(sub))return 'publication';
  if(sub==='analytics')return 'analytics';
  return 'dashboard';
 }
 if(path.includes('assistente'))return 'office';
 return 'dashboard';
};
const key='mm_universal_copilot_v1';
const newQueue=(id,group)=>({id,name:`Fila ${String(id).padStart(2,'0')}`,context:group,projectMode:'current',projectName:'',targetMode:'selected',targetName:'',assets:[],operations:[]});
function restore(){try {const s=JSON.parse(localStorage.getItem(key)||'null');if(s&&Array.isArray(s.queues)&&s.queues.length)return s;}catch{} return {queues:[newQueue(1,'media')],active:1,history:[],chat:[],suggestionsDismissed:[]};}
const statusStyle={queued:'text-amber-300',submitted:'text-sky-300',completed:'text-emerald-300',failed:'text-red-300',blocked:'text-amber-300'};
export default function UniversalCopilot(){
 const location=useLocation(); const group=detectGroup(location);const catalogue=GROUPS[group];
 const [showContext,setShowContext]=useState(true); const [showMcp,setShowMcp]=useState(false); const [projectOptions,setProjectOptions]=useState([]);const [mediaOptions,setMediaOptions]=useState([]);const [assetPicker,setAssetPicker]=useState(false);const [toolSettings,setToolSettings]=useState({});
 const [open,setOpen]=useState(()=>{try{return localStorage.getItem('mm_copilot_open')!=='0'}catch{return false}});
 const [tab,setTab]=useState('execute');const [data,setData]=useState(restore);const [input,setInput]=useState('');const [toolList,setToolList]=useState([]);const [status,setStatus]=useState('');const [expanded,setExpanded]=useState('');const [busy,setBusy]=useState(false);const [contextItem,setContextItem]=useState(null);
 const queue=data.queues.find(q=>q.id===data.active)||data.queues[0];
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(data))}catch{setStatus('Armazenamento local indisponível ou cheio.')}} ,[data]);
 useEffect(()=>{try{localStorage.setItem('mm_copilot_open',open?'1':'0')}catch{}},[open]);
 useEffect(()=>{listMCPTools().then(r=>setToolList(Array.isArray(r?.tools)?r.tools:[])).catch(()=>setToolList([]))},[]);
 const patchQueue=(patch)=>setData(s=>({...s,queues:s.queues.map(q=>q.id===s.active?{...q,...patch}:q)}));
  const history=(entry)=>setData(s=>({...s,history:[{id:globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random()),at:new Date().toISOString(),...entry},...s.history].slice(0,250)}));
 const addQueue=()=>{const id=Math.max(0,...data.queues.map(x=>x.id))+1;setData(s=>({...s,active:id,queues:[...s.queues,newQueue(id,group)]}));};
 const addAssets=(files)=>{const added=[...files].map(f=>({id:String(Date.now()+Math.random()),name:f.name,size:f.size,origin:'computador',attached:false}));patchQueue({assets:[...queue.assets,...added]});setStatus('Arquivos identificados no navegador. O upload e vínculo permanente requerem uma API de mídia conectada; nenhum arquivo foi enviado.')};
 const chooseTool=(label)=>toolList.find(t=>t.module===catalogue.module&&t.available&&String(t.title).toLocaleLowerCase('pt-BR')===label.toLocaleLowerCase('pt-BR'))||null;
 const changeSettings=(label,changes)=>setToolSettings(old=>({...old,[`${queue.id}:${label}`]:{...(old[`${queue.id}:${label}`]||{}),...changes}}));
 async function run(label,mode){
   const executor=chooseTool(label);const op={id:String(Date.now()+Math.random()),label,mode,status:mode==='later'?'queued':'blocked',queueId:queue.id,projectMode:queue.projectMode,projectName:queue.projectName,targetMode:queue.targetMode,targetName:queue.targetName,assets:[...queue.assets],settings:{...(toolSettings[`${queue.id}:${label}`]||{})},sourcePage:location.pathname+location.search,createdAt:new Date().toISOString()};
   if(mode==='later') {patchQueue({operations:[...queue.operations,op]});history({title:label,state:'queued',details:'Adicionado à fila local; ainda não executado.',operation:op});setStatus(`“${label}” adicionado à ${queue.name}.`);return;}
   if(!executor){history({title:label,state:'blocked',details:'Nenhum executor MCP correspondente anunciado pelo backend.',operation:op});setStatus('Ferramenta sem executor MCP disponível. Não houve execução.');return;}
   if(queue.projectMode==='new'&&!queue.projectName.trim()){setStatus('Informe o nome do novo projeto. A criação efetiva precisa estar conectada ao módulo de projetos.');return;}
   if(queue.assets.some(a=>!a.attached)){setStatus('Existem mídias externas ainda não enviadas ao servidor. Vincule-as pela biblioteca do projeto antes de executar.');return;}
   setBusy(true);
   try{
     const instruction=`${label}\nParâmetros: ${JSON.stringify(op.settings)}\nContexto de origem: ${location.pathname}${location.search}\nAlvo: ${queue.targetMode} ${queue.targetName}\nProjeto: ${queue.projectMode} ${queue.projectName}`;
     const result=await createMCPQueue({name:`Copiloto · ${queue.name} · ${label}`,module:catalogue.module,tool_name:executor.name,instruction,output_mode:'internal',execution_mode:'immediate',target_projects:queue.projectMode==='existing'&&queue.projectName?[queue.projectName]:[],create_projects:[],targets:[{id:`copilot-${queue.id}`,name:queue.targetName||'Seleção atual',kind:queue.targetMode==='selected'?'project':queue.targetMode,instruction}],export_name:null,export_destination:null});
     const state=result?.status==='completed'?'completed':'submitted';
     patchQueue({operations:[...queue.operations,{...op,status:state,backendQueueId:result?.id||result?.queue?.id||null}]});history({title:label,state,details:state==='completed'?'Backend informou conclusão.':'Solicitação recebida pelo backend; confira a fila MCP.',operation:op});setStatus(state==='completed'?'Backend informou conclusão.':'Enviado ao backend. Consulte a execução no MCP Completo.');
   }catch(e){history({title:label,state:'failed',details:e?.message||'Falha na solicitação MCP.',operation:op});setStatus(e?.message||'Falha no MCP.');}finally{setBusy(false)}
 }
 function chatSubmit(e){e.preventDefault();if(!input.trim())return;const message=input.trim();setData(s=>({...s,chat:[...s.chat,{role:'user',text:message,context:contextItem,at:new Date().toISOString()},{role:'system',text:'Comando registrado como rascunho. Este painel ainda não possui modelo de linguagem conectado; nenhuma alteração foi feita.',at:new Date().toISOString()}].slice(-150)}));history({title:'Comando de conversa',state:'queued',details:message});setInput('');}
 function discuss(entry){setContextItem(entry);setInput(`Conferir e corrigir: ${entry.title}. ${entry.details||''}`);setTab('execute');}
 const items=useMemo(()=>[...new Set([...catalogue.cards,...toolList.filter(t=>t.available&&t.module===catalogue.module).map(t=>t.title).filter(Boolean)])].slice(0,14),[catalogue,toolList]);
 if(!open)return <div className="sticky top-3 h-fit shrink-0"><button type="button" onClick={()=>setOpen(true)} className="flex items-center gap-1 rounded-lg border border-sky-700 bg-slate-900 px-2 py-3 text-xs font-bold text-sky-200 hover:bg-slate-800" title="Expandir Copiloto"><Bot size={19}/><span className="hidden sm:inline">IA</span></button></div>;
 return <aside aria-label="Copiloto IA universal" className="sticky top-3 flex h-[calc(100vh-110px)] min-h-[530px] w-[min(370px,42vw)] min-w-[275px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-slate-100 shadow-sm max-sm:w-[230px] max-sm:min-w-[230px]">
   <div className="flex items-center gap-2 border-b border-slate-800 p-3"><Bot className="text-sky-400" size={21}/><div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Copiloto IA + MCP</h2><p className="truncate text-[11px] text-slate-400">{catalogue.label} · {location.pathname}</p></div><button onClick={()=>setOpen(false)} title="Recolher" className="rounded-lg p-2 hover:bg-slate-800"><ChevronRight size={18}/></button></div>
   <div className="flex border-b border-slate-800 text-xs">{[['suggest','Sugestões',Lightbulb],['execute','Executar',MessageSquare],['history','Executado',History]].map(([value,label,Icon])=><button key={value} onClick={()=>setTab(value)} className={`flex flex-1 items-center justify-center gap-1 py-2 ${tab===value?'border-b-2 border-sky-400 bg-slate-800':'text-slate-400'}`}><Icon size={13}/>{label}</button>)}</div>
   <div className="flex-1 overflow-y-auto p-3 space-y-3">
    {tab==='suggest'&&<div className="space-y-2"><p className="text-xs text-slate-400">Sugestões de ferramentas para a página atual. Não são diagnósticos de IA.</p>{catalogue.cards.slice(0,5).map(t=><button key={t} onClick={()=>{setInput(`Quero preparar: ${t}.`);setTab('execute')}} className="block w-full rounded-lg border border-slate-700 p-2 text-left text-xs hover:bg-slate-800">{t} <span className="float-right text-sky-300">Conversar →</span></button>)}</div>}
    {tab==='history'&&<div className="space-y-2">{data.history.length===0?<p className="text-xs text-slate-400">Ainda não há registros locais.</p>:data.history.map(e=><div key={e.id} className="rounded-lg border border-slate-700 p-2 text-xs"><div className="flex justify-between gap-2"><b>{e.title}</b><span className={statusStyle[e.state]||'text-slate-300'}>{e.state}</span></div><p className="mt-1 text-slate-400">{e.details}</p><button className="mt-2 text-sky-300" onClick={()=>discuss(e)}>Conversar e corrigir →</button></div>)}</div>}
    {tab==='execute'&&<div className="space-y-2"><div className="min-h-[175px] max-h-[300px] space-y-2 overflow-y-auto rounded-lg bg-slate-900 p-3 text-xs">{data.chat.length===0?<p className="text-slate-400">Descreva o que deseja fazer. O comando será registrado; a conversa com IA real ainda requer integração.</p>:data.chat.slice(-7).map((m,i)=><p key={i} className={m.role==='user'?'text-sky-200':'text-slate-400'}>{m.text}</p>)}</div>{contextItem&&<div className="flex items-center justify-between rounded bg-sky-950 p-2 text-xs">Histórico: {contextItem.title}<button onClick={()=>setContextItem(null)}><X size={14}/></button></div>}<form onSubmit={chatSubmit} className="space-y-2"><textarea rows={4} className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm" value={input} onChange={e=>setInput(e.target.value)} placeholder="Converse, planeje ou descreva uma alteração. Pode escrever um comando longo..."/><button className="w-full rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold">Registrar comando</button></form></div>}
    <div className="border-t border-slate-700 pt-3"><div className="mb-2 flex items-center justify-between"><button onClick={()=>setShowMcp(v=>!v)} className="flex items-center gap-2 text-sm font-bold"><Wrench size={15}/> MCP · Ferramentas <ChevronDown size={14} className={showMcp?'':'-rotate-90'}/></button></div>
     {showMcp&&<><div className="mb-2 flex flex-wrap items-center gap-1">{data.queues.map(q=><button key={q.id} onClick={()=>setData(s=>({...s,active:q.id}))} className={`rounded-lg px-2 py-1 text-xs ${data.active===q.id?'bg-sky-700':'bg-slate-800'}`}>{q.name} ({q.operations.length})</button>)}<button title="Nova fila" onClick={addQueue} className="rounded-lg bg-slate-800 p-1.5"><Plus size={14}/></button></div>
     <details className="mb-2 text-xs"><summary className="cursor-pointer text-slate-400">Renomear {queue.name}</summary><input aria-label="Nome da fila" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs" value={queue.name} onChange={e=>patchQueue({name:e.target.value})}/></details><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><FolderOpen size={14}/> Projeto e destino</div>
     <label className="mb-1 block text-xs text-slate-400">Projeto</label><select className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs" value={queue.projectMode} onChange={e=>patchQueue({projectMode:e.target.value,projectName:''})}><option value="current">Usar projeto atual</option><option value="existing">Outro projeto existente</option><option value="new">Criar novo projeto</option></select>
     {queue.projectMode!=='current'&&<div className="mb-2"><input className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs" placeholder={queue.projectMode==='new'?'Nome do novo projeto':'ID/nome do projeto existente'} value={queue.projectName} onChange={e=>patchQueue({projectName:e.target.value})}/><p className="mt-1 text-[10px] text-amber-300">{queue.projectMode==='new'?'A criação do projeto ainda requer integração ao cadastro.':'Confirme o projeto no seletor real antes de executar.'}</p></div>}
     <label className="mb-1 block text-xs text-slate-400">Onde trabalhar</label><select className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs" value={queue.targetMode} onChange={e=>patchQueue({targetMode:e.target.value})}><option value="selected">{group==='edit'?'Timeline/clipe selecionado':group==='image'?'Prancheta ou camada atual':group==='video'?'Projeto/cena atual':group==='agency'?'Registro/guia atual':'Contexto da página atual'}</option>{['edit','video'].includes(group)&&<><option value="timeline">Outra timeline existente</option><option value="new-timeline">Nova timeline</option></>}{['image','edit'].includes(group)&&<option value="board">Prancheta / camada</option>}<option value="media">Mídias vinculadas</option></select>
     {queue.targetMode!=='selected'&&<input className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs" placeholder="ID ou nome da timeline / prancheta" value={queue.targetName} onChange={e=>patchQueue({targetName:e.target.value})}/>}
     <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1 text-xs font-semibold"><Paperclip size={14}/> Mídias vinculadas ({queue.assets.length})</span><span className="text-[10px] text-slate-500">Contexto desta fila</span></div>
     {queue.assets.map(a=><div key={a.id} className="mb-1 flex items-center gap-2 rounded bg-slate-900 p-2 text-xs"><span className="min-w-0 flex-1 truncate">{a.name} {a.attached?'':'(não enviado)'}</span><button onClick={()=>patchQueue({assets:queue.assets.filter(x=>x.id!==a.id)})}><X size={12}/></button></div>)}
     <div className="mb-2 flex flex-wrap gap-2"><button onClick={()=>setAssetPicker(v=>!v)} className="rounded border border-slate-700 px-2 py-1 text-xs">+ Do acervo</button><label className="cursor-pointer rounded border border-slate-700 px-2 py-1 text-xs">+ Computador<input type="file" multiple className="hidden" onChange={e=>{if(e.target.files?.length)addAssets(e.target.files);e.target.value=''}}/></label></div>
     {assetPicker&&<div className="mb-2 rounded-lg border border-slate-700 p-2 text-xs"><div className="mb-2 flex items-center justify-between"><b>Acervo MediaMindAI</b><button onClick={()=>setAssetPicker(false)}><X size={13}/></button></div><p className="text-slate-400">Conecte o seletor do acervo para pesquisar e vincular arquivos reais. Não adicionamos IDs não verificados.</p></div>}<div className="grid grid-cols-2 gap-2">{items.map(label=><div key={label} className="space-y-2 rounded-lg border border-slate-700 p-2"><div className="flex items-center gap-1 text-xs font-semibold"><Wrench size={13}/><span>{label}</span></div><button onClick={()=>setExpanded(expanded===label?'':label)} className="w-full rounded border border-slate-600 px-2 py-1 text-[11px]"><Settings2 size={12} className="mr-1 inline"/>Configurar</button>{expanded===label&&<div className="space-y-2 rounded bg-slate-900 p-2 text-[11px]"><label className="block">Alvo desta operação<select value={(toolSettings[`${queue.id}:${label}`]||{}).target||'queue'} onChange={e=>changeSettings(label,{target:e.target.value})} className="mt-1 w-full rounded bg-slate-800 p-1"><option value="queue">Usar destino da fila</option><option value="selection">Seleção atual da tela</option><option value="assets">Mídias vinculadas</option></select></label><label className="block">Instruções específicas<textarea value={(toolSettings[`${queue.id}:${label}`]||{}).instruction||''} onChange={e=>changeSettings(label,{instruction:e.target.value})} placeholder="Ex.: IN 00:00:10, OUT 00:00:25" rows={2} className="mt-1 w-full rounded bg-slate-800 p-2"/></label><p className="text-slate-400">As ferramentas conectadas definem seus parâmetros técnicos adicionais.</p></div>}<button disabled={busy||!chooseTool(label)} onClick={()=>run(label,'now')} title={chooseTool(label)?'Solicitar execução ao backend MCP':'Executor MCP indisponível'} className="flex w-full items-center justify-center gap-1 rounded bg-sky-700 p-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"><Play size={11}/> Executar agora</button><button onClick={()=>run(label,'later')} className="flex w-full items-center justify-center gap-1 rounded border border-slate-600 p-1.5 text-[11px]"><ListPlus size={12}/> Adicionar à fila</button></div>)}</div>
     <div className="mt-3 rounded-lg border border-slate-700 p-2"><h4 className="mb-2 text-xs font-bold">Operações · {queue.name}</h4>{queue.operations.length===0?<p className="text-[11px] text-slate-500">Fila vazia</p>:queue.operations.map(op=><div key={op.id} className="mb-1 flex gap-2 rounded bg-slate-900 p-1.5 text-[11px]"><span className="min-w-0 flex-1 truncate">{op.label}</span><span className={statusStyle[op.status]||''}>{op.status}</span><button title="Conversar" onClick={()=>discuss({title:op.label,details:JSON.stringify({project:op.projectName,target:op.targetMode,assets:op.assets.map(a=>a.name)})})}><MessageSquare size={12}/></button></div>)}</div>
     {status&&<p role="status" className="mt-2 rounded bg-slate-800 p-2 text-xs text-amber-200">{status}</p>}
     <p className="mt-2 text-[10px] text-slate-500">Filas locais não executam automaticamente. Arquivos do computador não são enviados ainda. Os MCPs antigos permanecem disponíveis.</p></>}
    </div>
   </div>
 </aside>;
}
