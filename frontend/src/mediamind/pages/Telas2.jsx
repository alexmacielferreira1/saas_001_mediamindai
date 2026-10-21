import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { Badge } from '../ui';
import { PageHeader2 } from '../components/acessos2/shared';

// Índice das "Telas 2": novas telas de acessos, equipe e IA, criadas a partir
// das imagens de referência, em paralelo às telas atuais (que continuam iguais).
export const TELAS2 = [
  { to: '/telas2/gestao', image: 'Painel de gestão da equipe', title: 'Gestão · Visão geral', data: 'Real', note: 'Pessoas, convites, suspensões e auditoria. Esteira por pessoa ainda sem fonte.' },
  { to: '/telas2/gestao?tab=equipe', image: 'Gestão de equipe e acessos', title: 'Gestão · Equipe', data: 'Real', note: 'Tabela de pessoas e painel “Ver como” (abrir visualização ainda indisponível).' },
  { to: '/telas2/gestao?tab=acessos', image: 'Administração de acessos e telas · Revisão de acesso', title: 'Gestão · Acessos e telas', data: 'Real (leitura)', note: 'Acesso efetivo por função e exceções gravadas. Revisão com motivo ainda indisponível.' },
  { to: '/telas2/gestao?tab=perfis', image: 'Gestão de acessos por perfil', title: 'Gestão · Acessos por função', data: 'Real (leitura)', note: 'Catálogo de funções em uso, telas da função e alcance da alteração.' },
  { to: '/telas2/gestao?tab=historico', image: 'Histórico de alterações no MediaMind', title: 'Gestão · Histórico', data: 'Real', note: 'Registros LogAuditoria do servidor. Reversão ainda indisponível.' },
  { to: '/telas2/apis-ia', image: 'Painel de APIs e IA do acervo', title: 'APIs e IA · Visão geral', data: 'Real (leitura)', note: 'Relatório /ai/usage. Sem dados: estado vazio.' },
  { to: '/telas2/apis-ia?tab=provedores', image: 'Configuração de provedores e chaves de IA', title: 'APIs e IA · Provedores e chaves', data: 'Real (leitura)', note: 'Gravação somente em Configurações de IA.' },
  { to: '/telas2/apis-ia?tab=consumo', image: 'Painel de consumo de APIs e IA', title: 'APIs e IA · Consumo', data: 'Real (leitura)', note: 'Repetições ainda não medidas.' },
];

export const TELAS2_PENDENTES = [
  { image: 'Visão do editor no MediaMind', reason: 'Depende do “Ver como usuário”, que ainda não existe no servidor.' },
  { image: 'Painel de trabalho de Marina Costa', reason: 'Depende do “Ver como” e de tarefas por pessoa no servidor.' },
];

export default function Telas2() {
  return (
    <div className="space-y-5 pb-8">
      <PageHeader2 kicker="Prévia" title="Telas 2" description="Novas telas de acessos, equipe e IA em paralelo às telas atuais. Os dados vêm do servidor; onde não há dado, a tela mostra vazio." right={<span className="grid h-10 w-10 place-items-center rounded-xl border border-sky-800/70 bg-sky-950/60 text-sky-300"><LayoutGrid size={20} aria-hidden="true" /></span>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TELAS2.map((item) => (
          <Link key={item.to} to={item.to} className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-sky-600">
            <div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-slate-100">{item.title}</h2><Badge tone="success">{item.data}</Badge></div>
            <p className="mt-1 text-xs text-slate-500">Referência: {item.image}</p>
            <p className="mt-2 text-sm text-slate-400">{item.note}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300 group-hover:underline">Abrir <ArrowRight size={13} aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Ainda não disponíveis</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">{TELAS2_PENDENTES.map((item) => <li key={item.image}><span className="text-slate-200">{item.image}:</span> {item.reason}</li>)}</ul>
      </section>
    </div>
  );
}
