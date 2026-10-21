import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, CircleDollarSign, Gauge, KeyRound, Lightbulb, Pencil, Plus, Repeat, ShieldCheck, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../ui';
import { AIConfigLink, AI_CONFIG_HINT, Card2, Empty2, formatDateTime, Metric2, Notice2, UnavailableButton } from './shared';

// Telas 2 de APIs e IA: somente leitura do relatório /ai/usage/report.
// Configuração e gravação pertencem a "Configurações de IA" (/configuracoes/ia).

export const usd = (value) => `US$ ${Number(value || 0).toFixed(2)}`;

export function connectionKind(connection) {
  const url = String(connection?.base_url || '').toLowerCase();
  return /localhost|127\.0\.0\.1|ollama/.test(url) || connection?.provider === 'ollama' ? 'Local' : 'Externa';
}

export function connectionStatus(connection) {
  if (!connection.enabled) return ['Desativada', 'error'];
  if (connectionKind(connection) === 'Local') return ['Local', 'info'];
  return connection.key_configured ? ['Configurado', 'success'] : ['Chave ausente', 'pending'];
}

function connectionsOf(report) {
  return report?.connections?.connections || [];
}

function Bars({ rows, valueKey = 'calls', format = (value) => value }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="flex justify-between text-xs"><span className="text-slate-300">{row.name}</span><span className="tabular-nums text-slate-400">{format(row[valueKey])}</span></div>
          <div className="mt-1 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.round(((Number(row[valueKey]) || 0) / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function StateBlock({ status, error }) {
  if (status === 'loading') return <p className="text-sm text-slate-400">Carregando relatório real de consumo…</p>;
  if (status === 'error') return <Notice2 tone="rose">{error} Nenhum número de exemplo foi usado.</Notice2>;
  return null;
}

// Imagem de referência: "Painel de APIs e IA do acervo".
export function IAVisaoGeral2({ status, report, error }) {
  const totals = report?.totals || {};
  const policy = report?.policy || {};
  const calls = totals.calls || 0;
  const success = calls ? `${((totals.ok || 0) / calls * 100).toFixed(1)}%` : '—';
  const monthly = Number(policy.monthly_limit_usd) || 0;
  const spent = Number(totals.priced_usd) || 0;
  const used = monthly ? Math.min(100, (spent / monthly) * 100) : 0;
  const connections = connectionsOf(report);
  const alerts = [
    ...connections.filter((item) => item.enabled && !item.key_configured && connectionKind(item) === 'Externa').map((item) => `Credencial ausente em ${item.name}`),
    ...(totals.unpriced_calls ? [`${totals.unpriced_calls} chamada(s) sem preço cadastrado`] : []),
    ...(totals.errors ? [`${totals.errors} chamada(s) com falha no período`] : []),
  ];
  return (
    <div className="space-y-4">
      <StateBlock status={status} error={error} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric2 label="Custo estimado" value={report ? usd(spent) : '—'} icon={CircleDollarSign} tone="sky" hint="Estimativa pelas tabelas de preço; não é fatura." />
        <Metric2 label="Orçamento mensal" value={report ? (monthly ? `${used.toFixed(1)}%` : 'Sem limite') : '—'} icon={Gauge} tone="violet" hint={monthly ? `de ${usd(monthly)}` : 'Nenhum limite mensal definido'} />
        <Metric2 label="Chamadas" value={report ? calls : '—'} icon={Activity} tone="emerald" />
        <Metric2 label="Sucesso" value={report ? success : '—'} icon={CheckCircle2} tone="amber" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card2 title="Consumo por funcionalidade" className="xl:col-span-2">
          {report?.groups?.features?.length ? <Bars rows={report.groups.features.slice(0, 8)} /> : <Empty2 title="Sem chamadas registradas no período" description="Somente rotas de IA instrumentadas entram nesta contagem." />}
        </Card2>
        <Card2 title="Orçamento mensal">
          {monthly ? (
            <>
              <p className="text-sm text-slate-300">{usd(spent)} de {usd(monthly)}</p>
              <div className="mt-2 h-2.5 rounded-full bg-slate-800"><div className="h-2.5 rounded-full bg-sky-500" style={{ width: `${used}%` }} /></div>
            </>
          ) : <Empty2 title="Sem orçamento definido" description="Defina limites em Configurações de IA." />}
          <AIConfigLink className="mt-3 inline-block" />
        </Card2>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card2 title="Alertas">
          {alerts.length ? <ul className="space-y-2">{alerts.map((text) => <li key={text} className="flex items-center gap-2 rounded-lg border border-amber-900/70 bg-slate-950/50 px-3 py-2 text-sm text-amber-200"><AlertTriangle size={14} aria-hidden="true" />{text}</li>)}</ul> : <Empty2 title="Nenhum alerta" description={report ? 'Nada a revisar no período.' : 'Relatório indisponível.'} />}
        </Card2>
        <Card2 title="Resumo de provedores">
          {connections.length ? <ul className="space-y-2">{connections.map((item) => { const [label, tone] = connectionStatus(item); return <li key={item.id} className="flex items-center justify-between gap-2 text-sm"><div><p className="text-slate-100">{item.name}</p><p className="text-xs text-slate-500">{item.provider} · {item.model || 'sem modelo'}</p></div><Badge tone={tone}>{label}</Badge></li>; })}</ul> : <Empty2 title="Nenhum provedor configurado" />}
        </Card2>
        <Card2 title="Otimização">
          <Empty2 title="Sem recomendações automáticas" description="A análise de otimização ainda não existe no servidor." />
          <UnavailableButton icon={Lightbulb} className="mt-3 w-full">Ver recomendações</UnavailableButton>
        </Card2>
      </div>
    </div>
  );
}

// Imagem de referência: "Configuração de provedores e chaves de IA".
export function IAProvedores2({ status, report, error }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const connections = connectionsOf(report).filter((item) => [item.name, item.provider, item.model].join(' ').toLowerCase().includes(search.toLowerCase()));
  const selected = connections.find((item) => item.id === selectedId) || null;
  const field = 'mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300';
  return (
    <div className="space-y-4">
      <StateBlock status={status} error={error} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card2 title="Provedores e chaves" description="Conexões de IA cadastradas no servidor (somente leitura nesta tela)." right={<Link to="/configuracoes/ia" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400" title={AI_CONFIG_HINT}><Plus size={15} aria-hidden="true" />Novo provedor</Link>}>
          <input type="search" aria-label="Buscar provedor" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar provedor ou modelo…" className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" />
          {connections.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-slate-800 text-xs text-slate-400"><tr><th className="p-2">Provedor</th><th className="p-2">Tipo</th><th className="p-2">Modelo</th><th className="p-2">Status</th><th className="p-2"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {connections.map((item) => { const [label, tone] = connectionStatus(item); return (
                    <tr key={item.id} className="border-b border-slate-800/60">
                      <td className="p-2"><p className="text-slate-100">{item.name}</p><p className="text-xs text-slate-500">{item.provider}</p></td>
                      <td className="p-2 text-slate-300">{connectionKind(item)}</td>
                      <td className="p-2 text-slate-300">{item.model || '—'}</td>
                      <td className="p-2"><Badge tone={tone}>{label}</Badge></td>
                      <td className="p-2"><button type="button" aria-label={`Ver ${item.name}`} onClick={() => setSelectedId(item.id)} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-sky-600"><Pencil size={14} /></button></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          ) : <Empty2 title="Nenhum provedor cadastrado" description={report ? 'Cadastre conexões em Configurações de IA.' : 'Relatório indisponível.'} />}
        </Card2>
        <aside aria-label="Configurar provedor" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="text-lg font-semibold text-slate-50">Configurar provedor</h2>
          {selected ? (
            <>
              <label className="block text-xs text-slate-400">Nome<input readOnly disabled value={selected.name || ''} className={field} /></label>
              <label className="block text-xs text-slate-400">Tipo<input readOnly disabled value={connectionKind(selected) === 'Local' ? 'Local' : 'API externa'} className={field} /></label>
              <label className="block text-xs text-slate-400">Provedor<input readOnly disabled value={selected.provider ?? ''} className={field} /></label>
              <label className="block text-xs text-slate-400">Chave API<input readOnly disabled value={selected.key_configured ? '•••••••••••••••• (cadastrada)' : 'Não cadastrada'} className={field} /></label>
              <label className="block text-xs text-slate-400">Modelo<input readOnly disabled value={selected.model || ''} className={field} /></label>
              <Notice2><span className="inline-flex items-center gap-1"><ShieldCheck size={13} aria-hidden="true" />Chave protegida no servidor; nunca é exibida.</span></Notice2>
            </>
          ) : <Empty2 title="Selecione um provedor" description="Use o botão de edição na tabela para ver os detalhes." />}
          <div className="flex flex-wrap justify-end gap-2">
            <UnavailableButton icon={KeyRound} title={AI_CONFIG_HINT}>Testar conexão</UnavailableButton>
            <UnavailableButton variant="primary" title={AI_CONFIG_HINT}>Salvar</UnavailableButton>
          </div>
          <AIConfigLink className="block text-right" />
        </aside>
      </div>
    </div>
  );
}

// Imagem de referência: "Painel de consumo de APIs e IA".
export function IAConsumo2({ status, report, error }) {
  const totals = report?.totals || {};
  const events = report?.events || [];
  return (
    <div className="space-y-4">
      <StateBlock status={status} error={error} />
      <div className="flex justify-end"><Link to="/dash-ias" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-sky-600">Exportar relatório (Dash de IAs)</Link></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric2 label="Custo estimado" value={report ? usd(totals.priced_usd) : '—'} icon={CircleDollarSign} tone="sky" />
        <Metric2 label="Chamadas" value={report ? totals.calls || 0 : '—'} icon={Activity} tone="emerald" />
        <Metric2 label="Falhas" value={report ? totals.errors || 0 : '—'} icon={XCircle} tone="rose" />
        <Metric2 label="Repetições" value="—" icon={Repeat} tone="amber" hint="Ainda não medido pelo servidor" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card2 title="Onde a IA é utilizada">
          {report?.groups?.features?.length ? (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs text-slate-400"><tr><th className="p-2">Funcionalidade</th><th className="p-2">Chamadas</th><th className="p-2">Falhas</th><th className="p-2">Custo</th></tr></thead>
              <tbody>{report.groups.features.map((row) => <tr key={row.name} className="border-b border-slate-800/60"><td className="p-2 text-slate-100">{row.name}</td><td className="p-2 tabular-nums text-slate-300">{row.calls}</td><td className="p-2 tabular-nums text-slate-300">{row.errors}</td><td className="p-2 text-slate-300">{usd(row.cost_usd)}{row.unpriced ? ' + ?' : ''}</td></tr>)}</tbody>
            </table>
          ) : <Empty2 title="Sem chamadas registradas" />}
        </Card2>
        <Card2 title="Análise e otimização">
          <Empty2 title="Análise automática ainda não disponível" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <UnavailableButton>Analisar consumo</UnavailableButton>
            <UnavailableButton>Ver evidências</UnavailableButton>
            <UnavailableButton>Criar tarefa</UnavailableButton>
            <UnavailableButton>Simular impacto</UnavailableButton>
          </div>
          <p className="mt-3 text-xs text-slate-500">Recomendações não alteram configurações automaticamente.</p>
        </Card2>
      </div>
      <Card2 title="Últimas chamadas">
        {events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs text-slate-400"><tr><th className="p-2">Data</th><th className="p-2">Operação</th><th className="p-2">Provedor</th><th className="p-2">Status</th><th className="p-2">Custo</th></tr></thead>
              <tbody>{events.slice(0, 15).map((row) => <tr key={row.id} className="border-b border-slate-800/60"><td className="whitespace-nowrap p-2 text-xs text-slate-400">{formatDateTime(row.at)}</td><td className="p-2 text-slate-100">{row.feature}</td><td className="p-2 text-slate-300">{row.provider} / {row.model}</td><td className="p-2"><Badge tone={row.status === 'ok' ? 'success' : 'error'}>{row.status === 'ok' ? 'Concluída' : 'Falhou'}</Badge></td><td className="p-2 text-slate-300">{row.cost_usd == null ? 'Sem preço' : usd(row.cost_usd)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <Empty2 title="Nenhuma chamada no período" />}
      </Card2>
      {report?.coverage?.other_modules && <Notice2 tone="amber">{report.coverage.other_modules}</Notice2>}
    </div>
  );
}
