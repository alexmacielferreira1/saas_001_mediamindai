import { useState } from 'react';
import { ContextDetailLayout, SelectableItem, UnavailableAction } from './ContextDetailLayout';

const box = 'rounded-xl border border-slate-800 bg-slate-950/45 p-4';
const selectedBox = (active) => `w-full rounded-xl border p-3 text-left ${active ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`;

const formDefinitions = [
  { name: 'Cadastro de convidado', meta: 'Público · 243 respostas', fields: ['Nome completo', 'E-mail', 'Telefone', 'Empresa', 'CPF', 'Observações'] },
  { name: 'Autorização de imagem', meta: 'Público · 189 respostas', fields: ['Nome completo', 'E-mail', 'Documento', 'Uso autorizado', 'Prazo da autorização', 'Assinatura'] },
  { name: 'Novo programa', meta: 'Interno · Rascunho', fields: ['Nome do programa', 'Editoria', 'Periodicidade', 'Responsável', 'Descrição'] },
  { name: 'Nova produção', meta: 'Interno · 34 respostas', fields: ['Título', 'Programa', 'Formato', 'Data prevista', 'Responsável', 'Briefing'] },
  { name: 'Solicitação de mídia', meta: 'Público · 67 respostas', fields: ['Solicitante', 'E-mail', 'Tipo de mídia', 'Período', 'Finalidade', 'Observações'] },
  { name: 'Cadastro de fornecedor', meta: 'Interno · Rascunho', fields: ['Razão social', 'CNPJ', 'Contato', 'E-mail', 'Serviço', 'Dados bancários'] },
];

function Field({ label }) {
  if (label === 'Uso autorizado') return <label className="text-xs text-slate-400">{label}<select aria-label={label} disabled className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"><option>Selecione</option></select></label>;
  return <label className="text-xs text-slate-400">{label}<input aria-label={label} disabled className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>;
}

export function FormsSection() {
  const [selected, setSelected] = useState(formDefinitions[0]);
  const master = <div className="space-y-2">{formDefinitions.map((form) => <SelectableItem key={form.name} selected={selected.name === form.name} onSelect={() => setSelected(form)} aria-label={`Selecionar ${form.name}`} className={selectedBox(selected.name === form.name)}><strong className="block text-slate-100">{form.name}</strong><span className="text-xs text-slate-500">{form.meta}</span></SelectableItem>)}</div>;
  const detail = <div className="space-y-4"><h3 className="text-lg font-bold text-slate-100">{selected.name}</h3><p className="text-sm text-slate-400">Pré-visualização somente leitura com campos próprios deste tipo.</p><div className="grid gap-3 sm:grid-cols-2">{selected.fields.map((field) => <Field key={field} label={field} />)}</div><UnavailableAction className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Editar formulário</UnavailableAction></div>;
  return <ContextDetailLayout master={master} detail={detail} detailTitle="Pré-visualização do formulário" isOpen showClose={false} />;
}

const importErrors = [{ line: 12, column: 'E-mail', problem: 'Formato inválido', value: 'joao.silva@' }, { line: 28, column: 'Equipe', problem: 'Equipe não encontrada', value: 'Vendas' }, { line: 47, column: 'Data', problem: 'Data inválida', value: '31/02/2024' }];
export function ImportsSection() {
  const [error, setError] = useState(importErrors[0]);
  const master = <div className="space-y-4"><div className={box}><strong className="text-emerald-300">usuarios_setembro.xlsx</strong><p className="text-xs text-slate-500">Arquivo processado · pré-visualização preservada</p></div><div className={box}><h3 className="mb-3 font-semibold">Mapeamento de colunas</h3>{[['Nome completo', 'name'], ['E-mail', 'email'], ['Equipe', 'team'], ['Cargo', 'job_title']].map(([a, b]) => <div key={a} className="flex justify-between border-b border-slate-800 py-2 text-sm"><span>{a}</span><span className="text-sky-300">{b}</span></div>)}</div><div className={box}><h3 className="mb-3 font-semibold">Resultado da validação</h3>{importErrors.map((item) => <SelectableItem key={item.line} selected={error.line === item.line} onSelect={() => setError(item)} aria-label={`Inspecionar erro da linha ${item.line}`} className={selectedBox(error.line === item.line)}>Linha {item.line} · {item.problem}</SelectableItem>)}</div></div>;
  const detail = <div className="space-y-3"><h3 className="text-lg font-bold">Erro da linha {error.line}</h3><dl className="space-y-2 text-sm"><div><dt className="text-slate-500">Coluna</dt><dd>{error.column}</dd></div><div><dt className="text-slate-500">Problema</dt><dd>{error.problem}</dd></div><div><dt className="text-slate-500">Valor</dt><dd className="text-rose-300">{error.value}</dd></div></dl><UnavailableAction className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Corrigir e importar</UnavailableAction></div>;
  return <div className="space-y-3"><button type="button" disabled className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Nova importação</button><ContextDetailLayout master={master} detail={detail} detailTitle={`Erro da linha ${error.line}`} isOpen showClose={false} /></div>;
}

const securityRules = [['Bloqueio por tentativas', 'Limite e duração aguardam integração'], ['Autenticação em duas etapas (MFA)', 'Política por perfil ainda não integrada'], ['Notificar administrador', 'Canal de alerta ainda não configurado'], ['Bloquear IPs suspeitos', 'Detecção ainda não integrada']];
export function SecuritySection({ users = [] }) {
  const [rule, setRule] = useState(securityRules[0]);
  const master = <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><div className={box}>Bloqueados <strong className="block text-xl">{users.filter((user) => user.status === 'blocked').length}</strong></div><div className={box}>Sessões ativas <strong className="block text-xl">—</strong></div><div className={box}>Tentativas 24h <strong className="block text-xl">—</strong></div></div>{securityRules.map((item) => <SelectableItem key={item[0]} selected={rule[0] === item[0]} onSelect={() => setRule(item)} aria-label={`Inspecionar ${item[0]}`} className={selectedBox(rule[0] === item[0])}>{item[0]}</SelectableItem>)}</div>;
  const detail = <div className="space-y-3"><h3 className="text-lg font-bold">{rule[0]}</h3><p className="text-sm text-slate-400">{rule[1]}</p><p className="text-xs text-amber-300">Nenhuma configuração simulada será tratada como política real.</p><UnavailableAction className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Alterar política</UnavailableAction></div>;
  return <ContextDetailLayout master={master} detail={detail} detailTitle={rule[0]} isOpen showClose={false} />;
}

const registry = { Produção: [['Workspace', 'Edição contextual'], ['Publicações', 'Distribuição']], Acervo: [['Arquivos', 'Catálogo e metadados']], Gestão: [['Visão Geral', 'Indicadores']], Administração: [['Usuários', 'Lista e detalhe contextual'], ['Formulários', 'Definições e respostas']] };
export function RegistrySection() {
  const [module, setModule] = useState('Produção');
  const [screen, setScreen] = useState(registry.Produção[0]);
  function chooseModule(name) { setModule(name); setScreen(registry[name][0]); }
  const master = <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-2">{Object.keys(registry).map((name) => <SelectableItem key={name} selected={module === name} onSelect={() => chooseModule(name)} className={selectedBox(module === name)}>{name}</SelectableItem>)}</div><div className={box}><h3 className="mb-2 font-semibold">Telas de {module}</h3>{registry[module].map((item) => <SelectableItem key={item[0]} selected={screen[0] === item[0]} onSelect={() => setScreen(item)} aria-label={`Tela ${item[0]}`} className={selectedBox(screen[0] === item[0])}>{item[0]}</SelectableItem>)}</div></div>;
  return <ContextDetailLayout master={master} detail={<div><h3 className="text-lg font-bold">{screen[0]}</h3><p className="mt-2 text-sm text-slate-400">{screen[1]}</p><p className="mt-4 text-xs text-amber-300">Estrutura de referência; não altera permissões reais.</p></div>} detailTitle={screen[0]} isOpen showClose={false} />;
}

const entities = ['Pessoa', 'Programa', 'Equipe', 'Biblioteca', 'Definição de formulário'];
export function RecordsSection() {
  const [entity, setEntity] = useState(entities[0]);
  return <ContextDetailLayout master={<div className="space-y-2"><h3 className="font-semibold text-slate-100">Entidades cadastradas</h3>{entities.map((name) => <SelectableItem key={name} selected={entity === name} onSelect={() => setEntity(name)} className={selectedBox(entity === name)}>{name}</SelectableItem>)}</div>} detail={<div><h3 className="text-lg font-bold">Campos de {entity}</h3><p className="mt-3 text-sm text-slate-400">Nome · Identificador · Status · Observações</p>{entity === 'Definição de formulário' && <p className="mt-4 text-sm text-amber-300">O catálogo ainda não possui registros persistidos para esta entidade.</p>}</div>} detailTitle={`Campos de ${entity}`} isOpen showClose={false} />;
}
