import { useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock3, Database, Download,
  FileSpreadsheet, FileText, FolderInput, HelpCircle, RefreshCw, Save, Upload,
  X,
} from 'lucide-react';

const panel = 'rounded-xl border border-sky-900/70 bg-[#031225]/90 shadow-[0_12px_32px_rgba(0,0,0,.2)]';
const outline = 'rounded-lg border border-sky-600 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500 hover:text-slate-950';

const previewRows = [
  ['1', 'Ana Clara Souza', 'ana.souza@empresa.com', 'Produto', '01/09/2024', 'Analista'],
  ['2', 'Bruno Martins', 'bruno.martins@empresa.com', 'Tecnologia', '15/08/2024', 'Desenvolvedor'],
  ['3', 'Carla Mendes', 'carla.mendes@empresa.com', 'Marketing', '10/07/2024', 'Analista'],
  ['4', 'Daniel Lima', 'daniel.lima@empresa.com', 'Tecnologia', '22/08/2024', 'DevOps'],
  ['5', 'Fernanda Alves', 'fernanda.alves@empresa.com', 'Produto', '03/09/2024', 'Product Owner'],
];

const mappings = [
  ['Nome completo', 'name (Nome completo)'], ['Email', 'email (E-mail)'], ['Equipe', 'team (Equipe)'],
  ['Data admissão', 'started_at (Data de admissão)'], ['Cargo', 'job_title (Cargo)'],
  ['Status', 'status (Status do usuário)'], ['Telefone', 'phone (Telefone)'],
  ['Departamento', 'department (Departamento)'], ['Observações', 'notes (Observações)'],
];

const errors = [
  ['12', 'Email', 'E-mail em formato inválido', 'joao.silva@'],
  ['28', 'Equipe', 'Equipe não encontrada', 'Vendas'],
  ['47', 'Data admissão', 'Data em formato inválido', '31/02/2024'],
  ['103', 'Email', 'E-mail já cadastrado', 'maria@empresa.com'],
  ['187', 'Nome completo', 'Campo obrigatório não preenchido', '—'],
];

const warnings = [
  ['33', 'Telefone', 'Telefone sem DDD', '99876-5432'],
  ['61', 'Cargo', 'Cargo não padronizado', 'Dev Sr'],
  ['94', 'Status', 'Status será normalizado', 'Ativa'],
];

const validRows = previewRows.slice(0, 4).map((row) => [row[0], row[1], 'Pronto para importar', row[2]]);

export default function Imports2() {
  const [step, setStep] = useState(2);
  const [validationTab, setValidationTab] = useState('Erros');
  const [drawer, setDrawer] = useState(null);
  const [fieldMappings, setFieldMappings] = useState(Object.fromEntries(mappings));

  const open = (title, type, data) => setDrawer({ title, type, data });
  const rows = validationTab === 'Erros' ? errors : validationTab === 'Alertas' ? warnings : validRows;

  return (
    <div className="relative space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><FolderInput className="mt-1 text-sky-400" size={30} /><div><h2 className="text-3xl font-bold text-white">Importação de Dados</h2><p className="text-sm text-slate-400">Faça upload, mapeie colunas, valide e importe dados em lote com segurança.</p></div></div>
        <div className="flex gap-2"><button type="button" onClick={() => open('Nova importação', 'new')} className="rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-300">＋ Nova importação</button><button type="button" onClick={() => open('Baixar modelo', 'template')} className={outline}><Download className="mr-2 inline" size={15} />Baixar modelo</button></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Database} label="Importações no mês" value="4" note="↗ +33% em relação ao mês anterior" tone="sky" onClick={() => open('Importações no mês', 'history')} />
        <Metric icon={Clock3} label="Última concluída" value="hoje" note="18 de setembro de 2026 · sucesso" tone="emerald" onClick={() => open('Última importação', 'report')} />
        <Metric icon={AlertTriangle} label="Erros pendentes" value="11" note="Em 3 importações · ver erros" tone="rose" onClick={() => open('Erros pendentes', 'errors')} />
        <Metric icon={FileText} label="Modelos salvos" value="2" note="Para reutilização" tone="sky" onClick={() => open('Modelos salvos', 'models')} />
      </section>

      <section className={panel}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-3"><button type="button" aria-label="Voltar" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><ArrowLeft size={17} /></button><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">Importação: usuarios_setembro.xlsx</h3><span className="rounded-md border border-emerald-700 bg-emerald-950 px-2 py-1 text-[10px] text-emerald-300">Arquivo carregado</span></div><p className="text-xs text-slate-500">Inicie o mapeamento das colunas para continuar.</p></div></div><button type="button" onClick={() => open('Mais ações', 'actions')} className={outline}>⋮ Mais ações⌄</button></header>

        <StepBar step={step} setStep={setStep} />

        <div className="grid items-start gap-3 p-3 2xl:grid-cols-[1.08fr_.82fr_1fr]">
          <section className={`${panel} p-3`}><SectionTitle icon={FileSpreadsheet} title="Arquivo e pré-visualização" /><div className="my-3 flex items-center gap-3 rounded-xl border border-slate-700 p-3"><span className="rounded-lg bg-emerald-950 p-3 text-emerald-400"><FileSpreadsheet /></span><div><strong className="text-sm">usuarios_setembro.xlsx</strong><p className="text-xs text-slate-500">12,4 MB · XLSX</p><p className="text-xs text-slate-500">Enviado em 18/09/2026 às 14:22</p><p className="mt-1 text-xs text-emerald-400">● Arquivo processado</p></div></div><p className="mb-2 text-xs text-slate-400">Pré-visualização (primeiras 5 linhas de 500)</p><DataTable headers={['#', 'Nome completo', 'Email', 'Equipe', 'Data admissão', 'Cargo']} rows={previewRows} /></section>

          <section className={`${panel} p-3`}><SectionTitle icon={Database} title="Mapeamento de colunas" help /><p className="mb-3 text-xs text-slate-500">Associe cada coluna do arquivo ao campo correspondente no sistema.</p><div className="overflow-hidden rounded-lg border border-slate-800"><div className="grid grid-cols-[.75fr_1.25fr] bg-sky-950/70 px-2 py-2 text-xs font-semibold"><span>Coluna no arquivo</span><span>Campo no sistema</span></div>{mappings.map(([column]) => <label key={column} className="grid grid-cols-[.75fr_1.25fr] items-center gap-2 border-t border-slate-800 px-2 py-1.5 text-xs"><span>{column}</span><select aria-label={`Mapear ${column}`} value={fieldMappings[column]} onChange={(event) => setFieldMappings((current) => ({ ...current, [column]: event.target.value }))} className="min-w-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"><option>{fieldMappings[column]}</option><option>Ignorar coluna</option><option>Campo personalizado</option></select></label>)}</div><div className="mt-3 flex justify-between gap-2"><button type="button" onClick={() => open('Salvar como modelo', 'save-model')} className={outline}><Save className="mr-1 inline" size={14} />Salvar como modelo</button><button type="button" onClick={() => open('Carregar modelo', 'models')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Carregar modelo⌄</button></div></section>

          <section className={`${panel} p-3`}><div className="flex items-start justify-between gap-2"><div><SectionTitle icon={CheckCircle2} title="Resultado da validação" /><p className="text-xs text-slate-500">Verifique os problemas encontrados antes de importar.</p></div><button type="button" onClick={() => open('Validar novamente', 'validate')} className={outline}><RefreshCw className="mr-1 inline" size={14} />Validar novamente</button></div><div className="my-3 grid grid-cols-4 gap-2"><SmallStat icon={FileText} value="500" label="linhas encontradas" tone="sky" /><SmallStat icon={CheckCircle2} value="468" label="válidas · 93,6%" tone="emerald" /><SmallStat icon={AlertTriangle} value="21" label="com alerta · 4,2%" tone="amber" /><SmallStat icon={X} value="11" label="com erro · 2,2%" tone="rose" /></div><div className="mb-2 grid grid-cols-3 gap-1">{['Erros', 'Alertas', 'Válidas'].map((tab) => <button type="button" key={tab} onClick={() => setValidationTab(tab)} className={`rounded-md border px-2 py-2 text-xs font-semibold ${validationTab === tab ? tab === 'Erros' ? 'border-rose-600 bg-rose-950/40 text-rose-300' : tab === 'Alertas' ? 'border-amber-600 bg-amber-950/30 text-amber-300' : 'border-emerald-600 bg-emerald-950/30 text-emerald-300' : 'border-slate-800 text-slate-400'}`}>{tab} ({tab === 'Erros' ? 11 : tab === 'Alertas' ? 21 : 468})</button>)}</div><DataTable headers={['Linha', 'Coluna', 'Problema', 'Valor']} rows={rows} rowAction={(row) => open(`${validationTab} · linha ${row[0]}`, 'row', row)} /><button type="button" onClick={() => open(`Todos os ${validationTab.toLowerCase()}`, 'errors')} className="mt-3 text-xs font-semibold text-sky-400">Ver todos os {validationTab.toLowerCase()} →</button></section>
        </div>
      </section>

      {drawer && <Drawer drawer={drawer} close={() => setDrawer(null)} step={step} setStep={setStep} />}
    </div>
  );
}

function StepBar({ step, setStep }) {
  const steps = [['Upload', 'Arquivo enviado'], ['Mapeamento', 'Associe as colunas'], ['Validação', 'Verifique os dados'], ['Importação', 'Processar dados'], ['Relatório', 'Resultado final']];
  return <nav aria-label="Etapas da importação" className="grid grid-cols-5 px-4 py-3">{steps.map(([title, subtitle], index) => { const number = index + 1; const done = number < step; const active = number === step; return <button type="button" key={title} onClick={() => setStep(number)} className="relative flex items-center gap-3 text-left after:absolute after:left-9 after:right-0 after:top-4 after:h-px after:bg-slate-700 last:after:hidden"><span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${done || active ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{done ? <Check size={15} /> : number}</span><span className="hidden xl:block"><strong className="block text-xs text-slate-200">{title}</strong><span className="text-[10px] text-slate-500">{subtitle}</span></span></button>; })}</nav>;
}

function Metric({ icon: Icon, label, value, note, tone, onClick }) { const color = { sky: 'text-sky-400', emerald: 'text-emerald-400', rose: 'text-rose-400' }[tone]; return <button type="button" onClick={onClick} className={`${panel} flex min-h-28 items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-500`}><span className={`rounded-xl border border-sky-900 bg-sky-950/50 p-3 ${color}`}><Icon size={28} /></span><span><span className="block text-sm text-slate-400">{label}</span><strong className={`block text-2xl text-white ${tone === 'rose' ? '!text-rose-300' : ''}`}>{value}</strong><span className={`block text-xs ${color}`}>{note}</span></span></button>; }
function SectionTitle({ icon: Icon, title, help }) { return <div className="flex items-center gap-2"><Icon className="text-sky-400" size={18} /><h3 className="font-bold text-slate-100">{title}</h3>{help && <HelpCircle className="text-sky-400" size={14} />}</div>; }
function SmallStat({ icon: Icon, value, label, tone }) { const color = { sky: 'text-sky-400', emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400' }[tone]; return <div className="rounded-lg border border-slate-800 p-2 text-center"><Icon className={`mx-auto ${color}`} size={17} /><strong className="mt-1 block text-lg">{value}</strong><span className={`block text-[10px] ${color}`}>{label}</span></div>; }
function DataTable({ headers, rows, rowAction }) { return <div className="overflow-x-auto rounded-lg border border-slate-800"><table className="w-full min-w-[560px] text-left text-[11px]"><thead className="bg-sky-950/70"><tr>{headers.map((header) => <th key={header} className="px-2 py-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} onClick={() => rowAction?.(row)} className={`border-t border-slate-800 text-slate-300 ${rowAction ? 'cursor-pointer hover:bg-sky-950/20' : ''}`}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-2 py-2 ${cellIndex === 0 && rowAction ? 'text-rose-400' : ''}`}>{cell}</td>)}</tr>)}</tbody></table></div>; }

function Drawer({ drawer, close, step, setStep }) {
  return <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside role="dialog" aria-modal="true" aria-label={drawer.title} className="h-full w-full max-w-xl overflow-y-auto border-l border-sky-800 bg-mm-drawer shadow-2xl"><header className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-mm-drawer px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-sky-400">Importações 2</p><h2 className="text-xl font-bold">{drawer.title}</h2></div><button type="button" aria-label="Fechar painel" onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X /></button></header><div className="space-y-4 p-5"><p className="rounded-lg border border-sky-900 bg-sky-950/30 p-3 text-xs text-sky-300">Prévia funcional local. Os dados desta apresentação não serão enviados ao servidor.</p>{drawer.type === 'new' ? <><div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-sky-700 bg-sky-950/20 text-center"><div><Upload className="mx-auto text-sky-400" size={34} /><strong className="mt-2 block">Arraste um arquivo ou selecione no computador</strong><p className="text-xs text-slate-500">XLSX, CSV ou JSON · até 50 MB</p></div></div><button type="button" onClick={() => { setStep(1); close(); }} className="w-full rounded-lg bg-sky-400 p-3 font-bold text-slate-950">Selecionar arquivo</button></> : drawer.type === 'row' ? <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800">{['Linha', 'Coluna', 'Problema', 'Valor'].map((label, index) => <div key={label} className="flex justify-between p-3"><dt className="text-slate-500">{label}</dt><dd>{drawer.data[index]}</dd></div>)}</dl> : drawer.type === 'template' ? <><p className="text-sm text-slate-300">Escolha o modelo de planilha com os campos aceitos pelo sistema.</p><button type="button" className="flex w-full items-center justify-between rounded-xl border border-slate-800 p-4"><span className="flex items-center gap-3"><FileSpreadsheet className="text-emerald-400" />Modelo de usuários</span><Download size={18} /></button></> : <div className="space-y-3">{['Usuários · padrão', 'Programas e produções', 'Fornecedores'].map((item) => <button type="button" key={item} className="flex w-full items-center justify-between rounded-xl border border-slate-800 p-4 text-left hover:border-sky-600"><span>{item}</span><span className="text-sky-400">Abrir →</span></button>)}</div>}</div></aside></div>;
}
