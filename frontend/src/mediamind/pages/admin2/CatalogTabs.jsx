import { useState } from 'react';
import { Activity } from 'lucide-react';
import { RecordsSection, RegistrySection } from '../../components/admin2/GovernanceSections';
import {
  DemoTable, InfoRow, MetricTile, PageLead, PreviewNotice, StatusLine,
} from '../../components/admin2/ui/AdminBlocks';
import { Badge, EmptyState, Panel, Tabs } from '../../ui';

// Telas e Módulos, Cadastros e Integrações: prévias estruturais sem catálogo persistido.

const VIEWS = [{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Versão anterior' }];

const listItemClass = (selected) => (
  `w-full rounded-lg border p-3 text-left ${selected ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`
);

const SCREEN_TREE = [
  ['Produção', '6 módulos', 'Workspace, Aprovação e Publicações'],
  ['Acervo', '3 módulos', 'Arquivos, Usuários e Sistema'],
  ['Gestão', '4 módulos', 'Visão Geral, Relatórios, Processamentos e Auditoria'],
  ['Administração', '11 módulos', 'Usuários, acessos, equipes e governança'],
];

export function RegistryTab() {
  const [view, setView] = useState('reference');
  return (
    <div className="space-y-4">
      <PageLead
        title="Registro de telas e módulos"
        description="Mapa estrutural de produtos, módulos, telas, seções e ações controláveis."
      />
      <PreviewNotice />
      <Panel title="Hierarquia do produto"><Tabs tabs={VIEWS} active={view} onChange={setView} /></Panel>
      {view === 'reference' ? <RegistrySection /> : <LegacyRegistry />}
    </div>
  );
}

function LegacyRegistry() {
  const [selected, setSelected] = useState('Produção');
  const selectedItem = SCREEN_TREE.find(([name]) => name === selected) || SCREEN_TREE[0];
  return (
    <div className="space-y-4">
      <PageLead
        title="Registro de telas e módulos"
        description="Mapa estrutural de produtos, módulos, telas, seções e ações controláveis."
      />
      <PreviewNotice />
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricTile label="Produtos persistidos" value="—" />
        <MetricTile label="Módulos persistidos" value="—" />
        <MetricTile label="Telas persistidas" value="—" />
        <MetricTile label="Ações persistidas" value="—" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Panel title="Hierarquia do produto">
          <div className="rounded-lg border border-sky-900/70 bg-sky-950/20 p-3">
            <p className="font-semibold text-sky-200">MediaMind AI</p>
            <p className="text-xs text-slate-500">Estrutura de referência, ainda sem catálogo persistente</p>
          </div>
          <div className="mt-3 space-y-2">
            {SCREEN_TREE.map(([name, , description]) => (
              <button type="button" key={name} onClick={() => setSelected(name)} className={listItemClass(selected === name)}>
                <strong>{name}</strong>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </button>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={`${selectedItem[0]} · estrutura selecionada`} right={<Badge tone="pending">Não persistido</Badge>}>
            <p className="text-sm text-slate-400">
              A estrutura abaixo documenta a hierarquia esperada. Contadores serão exibidos somente quando vierem do
              catálogo do tenant.
            </p>
          </Panel>
          <Panel title="Mapa de seções e ações">
            <DemoTable
              headers={['Nível', 'Identificador', 'Visibilidade', 'Ações']}
              rows={[
                ['Módulo', selected, 'A definir', 'Acessar'],
                ['Tela', selected === 'Produção' ? 'Workspace' : 'Visão Geral', 'A definir', 'Visualizar, editar'],
                ['Seção', 'Painel principal', 'A definir', 'Visualizar'],
                ['Widget', 'Indicadores', 'A definir', 'Visualizar, exportar'],
              ]}
            />
            <p className="mt-3 text-xs text-amber-300">Esta referência ainda não altera permissões reais.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const RECORD_ENTITIES = [
  ['Pessoa', '34', 'Usuários e contatos', 'Parcial'],
  ['Programa', '12', 'Produção editorial', 'Mapeado'],
  ['Equipe', '7', 'Estrutura organizacional', 'Parcial'],
  ['Biblioteca', '6', 'Acervo', 'Mapeado'],
  ['Definição de formulário', '9', 'Administração', 'Planejado'],
];

export function RecordsTab() {
  const [view, setView] = useState('reference');
  return (
    <div className="space-y-4">
      <PageLead
        title="Cadastros administrativos"
        description="Catálogo das entidades compartilhadas e seus vínculos com os módulos."
      />
      <PreviewNotice />
      <Tabs tabs={VIEWS} active={view} onChange={setView} />
      {view === 'reference' ? <RecordsSection /> : <LegacyRecords />}
    </div>
  );
}

function LegacyRecords() {
  const [selected, setSelected] = useState('Pessoa');
  return (
    <div className="space-y-4">
      <PageLead
        title="Cadastros administrativos"
        description="Catálogo das entidades compartilhadas e seus vínculos com os módulos."
      />
      <PreviewNotice />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title="Entidades cadastradas">
          <div className="space-y-2">
            {RECORD_ENTITIES.map(([name, count, domain, status]) => (
              <button type="button" key={name} onClick={() => setSelected(name)} className={listItemClass(selected === name)}>
                <div className="flex items-center justify-between">
                  <strong>{name}</strong>
                  <span className="text-xl font-bold text-sky-300">{count}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{domain}</span>
                  <span>{status}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={`${selected} · definição`} right={<Badge tone="pending">Catálogo preliminar</Badge>}>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Registros" value={RECORD_ENTITIES.find(([name]) => name === selected)?.[1] || '—'} />
              <MetricTile label="Campos" value="8" />
              <MetricTile label="Vínculos" value="3" />
            </div>
          </Panel>
          <Panel title="Campos e governança">
            <DemoTable
              headers={['Campo', 'Tipo', 'Obrigatório', 'Fonte']}
              rows={[
                ['Nome', 'Texto', 'Sim', 'Cadastro'],
                ['Identificador', 'UUID', 'Sim', 'Sistema'],
                ['Status', 'Enum', 'Sim', 'Workflow'],
                ['Observações', 'Texto longo', 'Não', 'Cadastro'],
              ]}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatusLine label="Escopo do tenant" value="Obrigatório" />
              <StatusLine label="Auditoria append-only" value="Planejada" />
              <StatusLine label="Exclusão lógica" value="Planejada" />
              <StatusLine label="Validação no servidor" value="Pendente" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const INTEGRATIONS = [
  ['API MediaMind', 'Interna', 'Endpoint local verificado'],
  ['PostgreSQL / Neon', 'Dados', 'Configuração não exibida'],
  ['Armazenamento', 'Mídia', 'Estado não verificado'],
  ['Transcrição', 'IA', 'Estado não verificado'],
  ['OCR', 'IA', 'Estado não verificado'],
  ['Redes sociais', 'Publicação', 'Não integradas'],
];

export function IntegrationsTab() {
  const [selected, setSelected] = useState('API MediaMind');
  return (
    <div className="space-y-4">
      <PageLead
        title="Integrações"
        description="Inventário de conexões internas e externas, credenciais e sincronizações."
      />
      <PreviewNotice />
      <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-200">
        Nenhuma integração validada por esta tela. Estados abaixo são inventário técnico, não monitoramento em tempo real.
      </div>
      <div className="grid gap-4 xl:grid-cols-[460px_1fr]">
        <Panel title="Saúde das integrações">
          <div className="space-y-2">
            {INTEGRATIONS.map(([name, type, status]) => (
              <button
                type="button"
                key={name}
                onClick={() => setSelected(name)}
                className={`flex items-center justify-between gap-3 ${listItemClass(selected === name)}`}
              >
                <span>
                  <strong className="block">{name}</strong>
                  <span className="text-xs text-slate-500">{type}</span>
                </span>
                <Badge tone={status.includes('Não') || status.includes('não') ? 'pending' : 'info'}>{status}</Badge>
              </button>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={selected} right={<Badge tone="pending">Somente inventário</Badge>}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <InfoRow label="Ambiente">Não exposto</InfoRow>
              <InfoRow label="Credenciais">Protegidas / não exibidas</InfoRow>
              <InfoRow label="Última verificação">Não executada</InfoRow>
              <InfoRow label="Responsável">A definir</InfoRow>
            </dl>
          </Panel>
          <Panel title="Eventos e sincronização">
            <EmptyState
              icon={Activity}
              title="Telemetria ainda não conectada"
              description="Quando houver endpoint de saúde e auditoria, esta área mostrará falhas, latência, tentativas e última sincronização reais."
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
