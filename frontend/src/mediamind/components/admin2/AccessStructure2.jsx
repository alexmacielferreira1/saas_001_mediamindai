import { useMemo, useState } from 'react';
import {
  Building2, BriefcaseBusiness, ChevronRight, CircleUserRound, Database, FileClock, FileText,
  KeyRound, Layers3, LockKeyhole, Pencil, Plus, Search, ShieldCheck, Users, Video, X,
} from 'lucide-react';
import { outline, panel } from './ui/styles';

// Perfis e Permissões usam os grupos de permissão reais do tenant (GET /permission-groups).
// Equipes continua demonstrativa até existir o modelo de equipes no servidor.

const UNAVAILABLE_REASON = 'Disponível na próxima etapa; nenhuma alteração é simulada.';
const CRITICAL_ACTIONS = ['manage', 'delete', 'approve'];

function splitCode(code) {
  const [module, ...rest] = code.split(/[.:]/);
  return [module, rest.join('.') || code];
}

function modulesOf(codes) {
  return [...new Set(codes.map((code) => splitCode(code)[0]))].sort();
}

function linkedUsers(users, group) {
  return users.filter((user) => user.profile_id === group.id);
}

export function Profiles2({ groups = [], users = [], available = true }) {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(null);
  const visible = groups.filter((group) => group.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = groups.find((group) => group.id === selectedId) || groups[0] || null;
  const linked = selected ? linkedUsers(users, selected) : [];
  const roles = [...new Set(linked.map((user) => user.tenant_role).filter(Boolean))];
  const codes = selected?.permission_codes || [];
  const modules = modulesOf(codes);
  return (
    <div className="space-y-4">
      <Lead
        title="Perfis e Funções"
        description="Crie perfis reutilizáveis, vincule cargos e padronize acessos."
        action={<Unavailable primary icon={Plus}>Novo perfil</Unavailable>}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[360px_1fr]">
        <section className={`${panel} p-3`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Perfis cadastrados <Count>{groups.length}</Count></h3>
          </div>
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar perfil..." />
          <div className="mt-3 space-y-2">
            {visible.map((group) => (
              <ProfileCard
                key={group.id}
                group={group}
                users={linkedUsers(users, group).length}
                active={selected?.id === group.id}
                onClick={() => setSelectedId(group.id)}
              />
            ))}
            {!groups.length && <Empty>{available ? 'Nenhum perfil cadastrado neste tenant.' : 'Perfis indisponíveis: não foi possível carregar os grupos de permissão.'}</Empty>}
            {groups.length > 0 && !visible.length && <Empty>Nenhum perfil corresponde à busca.</Empty>}
          </div>
        </section>
        <div className="space-y-3">
          {selected && (
            <section className={`${panel} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-sky-950 p-3 text-sky-400"><ShieldCheck size={26} /></span>
                  <div>
                    <h3 className="text-xl font-bold">{selected.name}</h3>
                    <p className="text-sm text-slate-400">{selected.description || 'Perfil sem descrição.'}</p>
                    <p className="mt-1 text-xs text-slate-500"><Badge active={selected.is_active}>{selected.is_active ? 'Ativo' : 'Inativo'}</Badge></p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Unavailable icon={Pencil}>Editar</Unavailable>
                  <Unavailable>Duplicar perfil</Unavailable>
                  <Action icon={Users} onClick={() => setDrawer({ title: `Usuários de ${selected.name}`, type: 'users' })}>Ver usuários</Action>
                </div>
              </div>
            </section>
          )}
          <div className="grid gap-3 lg:grid-cols-[1fr_.72fr]">
            <section className={`${panel} p-3`}>
              <Title icon={KeyRound}>Resumo do perfil</Title>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Mini label="permissões liberadas" value={selected ? codes.length : '—'} />
                <Mini label="usuários vinculados" value={selected ? linked.length : '—'} />
                <Mini label="funções vinculadas" value={selected ? roles.length : '—'} />
              </div>
            </section>
            <section className={`${panel} p-3`}>
              <Title icon={BriefcaseBusiness}>Funções associadas</Title>
              <div className="mt-4 flex flex-wrap gap-2">
                {roles.map((role) => <Tag key={role}>{role}</Tag>)}
                {!roles.length && <Empty>Nenhum usuário vinculado a este perfil.</Empty>}
              </div>
            </section>
          </div>
          <section className={`${panel} p-3`}>
            <Title icon={Layers3}>Módulos liberados</Title>
            <div className="mt-3 flex flex-wrap gap-2">
              {modules.map((module) => <Tag key={module}>{module}</Tag>)}
              {!modules.length && <Empty>Nenhum módulo liberado.</Empty>}
            </div>
          </section>
          <section className={`${panel} p-3`}>
            <Title icon={ShieldCheck}>Matriz resumida de permissões</Title>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => (
                <div key={module} className="rounded-lg border border-slate-800 p-3">
                  <strong className="text-sm">{module}</strong>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {codes.filter((code) => splitCode(code)[0] === module).map((code) => (
                      <span key={code} className="rounded bg-emerald-950 px-2 py-1 text-[10px] text-emerald-300 ring-1 ring-emerald-700">{splitCode(code)[1]}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!modules.length && <Empty>Nenhuma permissão explícita.</Empty>}
          </section>
          <PendingHistory title="Histórico do perfil" />
        </div>
      </div>
      {drawer && selected && (
        <Drawer title={drawer.title} close={() => setDrawer(null)}>
          {linked.length ? (
            <SimpleTable headers={['Nome', 'E-mail', 'Função']} rows={linked.map((user) => [user.full_name || user.email, user.email, user.tenant_role || '—'])} />
          ) : <Empty>Nenhum usuário vinculado a este perfil.</Empty>}
        </Drawer>
      )}
    </div>
  );
}

const teams = [
  ['Produção', '18 membros', 'Mariana Silva', Video], ['Jornalismo', '12 membros', 'Carlos Mendes', FileText],
  ['Audiovisual', '11 membros', 'Rafael Lima', Video], ['Social Media', '7 membros', 'Juliana Costa', Users],
  ['CEDOC', '6 membros', 'Ana Paula Ribeiro', Database], ['Comunicação', '9 membros', 'Felipe Martins', CircleUserRound],
];
const members = [['Rafael Lima', 'Coordenador', 'Administrador'], ['Marina Souza', 'Videomaker', 'Usuário'], ['Bruno Carvalho', 'Editor de vídeo', 'Usuário'], ['Larissa Fernandes', 'Motion Designer', 'Usuário'], ['Thiago Pereira', 'Produtor de reportagem', 'Usuário']];

export function Teams2() {
  const [selected, setSelected] = useState('Audiovisual'); const [drawer,setDrawer]=useState(null);
  return <div className="space-y-4"><Lead title="Equipes / Setores / Unidades" description="Organize a estrutura operacional da organização e vincule usuários aos seus grupos." action={<div className="flex gap-2">{['Nova equipe','Novo setor','Nova unidade'].map((label,index)=><button key={label} className={index===0?'rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950':outline} onClick={()=>setDrawer({title:label,type:'form'})}><Plus className="mr-1 inline" size={15}/>{label}</button>)}</div>} />
    <div className="grid items-start gap-4 xl:grid-cols-[320px_1fr]"><section className={`${panel} p-3`}><Title icon={Users}>Equipes da organização</Title><div className="mt-3"><SearchBox placeholder="Buscar equipe, coordenador ou palavra-chave..."/></div><div className="mt-3 space-y-2">{teams.map(([name,count,leader,Icon])=><button key={name} onClick={()=>setSelected(name)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected===name?'border-sky-400 bg-sky-950/40':'border-slate-800 hover:border-sky-700'}`}><span className="rounded-lg bg-sky-950 p-2 text-sky-400"><Icon/></span><span className="flex-1"><strong className="block text-sm">{name}</strong><span className="block text-xs text-slate-400">{count}</span><span className="block text-[10px] text-slate-500">Coordenador: {leader}</span></span><ChevronRight size={17}/></button>)}</div></section>
      <div className="space-y-3"><section className={`${panel} p-4`}><div className="flex justify-between"><div className="flex gap-3"><span className="rounded-xl bg-sky-950 p-3 text-sky-400"><Video/></span><div><h3 className="text-xl font-bold">{selected}</h3><p className="text-sm text-slate-400">Produção e edição de conteúdo audiovisual.</p></div></div><Action icon={Pencil} onClick={()=>setDrawer({title:'Editar equipe',type:'form'})}>Editar equipe</Action></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Info icon={CircleUserRound} label="Coordenador(a)" value="Rafael Lima"/><Info icon={Users} label="Membros" value="11"/><Info icon={Building2} label="Unidade vinculada" value="Produção e Criação"/><Info icon={Layers3} label="Setores associados" value="2"/></div></section>
        <div className="grid gap-3 lg:grid-cols-[1.1fr_.8fr_.72fr]"><Box title="Principais funções na equipe" items={['Videomaker','Editor de vídeo','Produtor de reportagem','Motion Designer','Estagiário']}/><Box title="Módulos mais utilizados" items={['Produção','Edição','Workflow','Mídia','Publicação','Armazenamento']}/><section className={`${panel} p-3`}><div className="flex justify-between"><Title icon={Building2}>Unidades</Title><button className="text-xs text-sky-400" onClick={()=>setDrawer({title:'Unidades',type:'units'})}>Ver todas →</button></div>{['Produção e Criação','Conteúdo Editorial','Acervo e Preservação'].map(item=><button key={item} className="flex w-full justify-between border-b border-slate-800 py-3 text-left text-xs">{item}<ChevronRight size={15}/></button>)}</section></div>
        <section className={`${panel} p-3`}><div className="flex items-center gap-2"><Title icon={Users}>Membros da equipe</Title><Count>11</Count></div><div className="mt-3"><SimpleTable headers={['Nome','Função','Perfil','Status','']} rows={members.map(row=>[row[0],row[1],row[2],<Badge key={row[0]}>Ativo</Badge>,<button key={`${row[0]}a`} onClick={()=>setDrawer({title:row[0],type:'member'})}>⋮</button>])}/></div><button className="mt-3 text-xs text-sky-400" onClick={()=>setDrawer({title:'Membros da equipe',type:'users'})}>Ver todos os 11 membros →</button></section>
      </div></div>{drawer&&<Drawer title={drawer.title} close={()=>setDrawer(null)}><DrawerBody type={drawer.type}/></Drawer>}</div>;
}

export function Permissions2({ groups = [], available = true }) {
  const [profileId, setProfileId] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(null);
  const group = groups.find((item) => item.id === profileId) || groups[0] || null;
  const catalog = useMemo(() => [...new Set(groups.flatMap((item) => item.permission_codes))].sort(), [groups]);
  const actions = [...new Set(catalog.map((code) => splitCode(code)[1]))].sort();
  const allModules = modulesOf(catalog);
  const term = search.trim().toLowerCase();
  const rows = allModules.filter((module) => (!moduleFilter || module === moduleFilter) && (!term || module.toLowerCase().includes(term)));
  const granted = group ? group.permission_codes.length : 0;
  const critical = catalog.filter((code) => CRITICAL_ACTIONS.some((word) => code.includes(word)));
  const has = (code) => Boolean(group?.permission_codes.includes(code));
  function clearFilters() { setSearch(''); setModuleFilter(''); setProfileId(''); }
  return (
    <div className="space-y-4">
      <Lead title="Permissões" description="Controle técnico de ações por módulo, operação e escopo." />
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <section className={`${panel} p-3`}>
            <div className="grid gap-3 lg:grid-cols-[1.2fr_.65fr_.65fr_.65fr_auto]">
              <SearchBox value={search} onChange={setSearch} placeholder="Buscar permissão, módulo ou ação..." />
              <Select label="Perfil" value={group?.id || ''} setValue={setProfileId} options={groups.map((item) => [item.id, item.name])} />
              <Select label="Módulo" value={moduleFilter} setValue={setModuleFilter} options={[['', 'Todos os módulos'], ...allModules.map((module) => [module, module])]} />
              <Select label="Escopo" value="tenant" options={[['tenant', 'Tenant selecionado']]} />
              <button type="button" className={outline} onClick={clearFilters}>↻ Limpar filtros</button>
            </div>
            {group && <div className="mt-3"><Tag>Perfil: {group.name}</Tag></div>}
            <div className="mt-3 overflow-x-auto">
              {rows.length && actions.length ? (
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-sky-950/50">
                    <tr>
                      <th className="p-3">Módulo</th>
                      {actions.map((item) => <th key={item} className="p-3 text-center">{item}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((module) => (
                      <tr key={module} className="border-t border-slate-800">
                        <td className="p-3 font-bold text-slate-100">{module}</td>
                        {actions.map((item) => {
                          const code = catalog.find((entry) => splitCode(entry)[0] === module && splitCode(entry)[1] === item);
                          return <td key={item} className="p-2 text-center">{code ? <Permission allowed={has(code)} /> : <span className="text-slate-600">—</span>}</td>;
                        })}
                        <td>
                          <button type="button" aria-label={`Permissões de ${module}`} onClick={() => setDrawer({ title: `Permissões de ${module}`, module })}><ChevronRight /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <Empty>{!available ? 'Permissões indisponíveis: não foi possível carregar os grupos de permissão.' : catalog.length ? 'Nenhum módulo corresponde aos filtros.' : 'Nenhuma permissão cadastrada nos perfis deste tenant.'}</Empty>}
            </div>
          </section>
          <PendingHistory title="Alterações recentes" />
        </div>
        <aside className="space-y-3">
          <section className={`${panel} p-4`}>
            <Title icon={CircleUserRound}>Resumo do perfil</Title>
            <h3 className="mt-2 font-bold">{group?.name || 'Nenhum perfil'}</h3>
            <p className="text-xs text-slate-500">Visão consolidada das permissões deste perfil.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Summary value={group ? granted : '—'} label="Permitidas" tone="emerald" />
              <Summary value={group ? catalog.length - granted : '—'} label="Negadas" tone="rose" />
              <Summary value={group ? modulesOf(group.permission_codes).length : '—'} label="Módulos" tone="sky" />
            </div>
          </section>
          <section className={`${panel} p-4`}>
            <Title icon={Layers3}>Origem das permissões</Title>
            <div className="mt-4 flex justify-between text-xs"><span>Perfil (direto)</span><span>{group ? granted : '—'}</span></div>
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Função (herdado)</span><span>Não integrado</span></div>
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Exceção</span><span>Não integrado</span></div>
          </section>
          <section className={`${panel} p-4`}>
            <Title icon={LockKeyhole}>Permissões críticas</Title>
            {critical.map((code) => (
              <div key={code} className="flex w-full justify-between border-b border-slate-800 py-3 text-left text-xs">
                <span>{code}</span>
                <span className={has(code) ? 'text-emerald-400' : 'text-rose-400'}>{has(code) ? 'Permitido' : 'Negado'}</span>
              </div>
            ))}
            {!critical.length && <Empty>Nenhuma permissão crítica cadastrada.</Empty>}
          </section>
        </aside>
      </div>
      {drawer && (
        <Drawer title={drawer.title} close={() => setDrawer(null)}>
          <SimpleTable
            headers={['Permissão', group ? group.name : 'Perfil']}
            rows={catalog.filter((code) => splitCode(code)[0] === drawer.module).map((code) => [code, <Permission key={code} allowed={has(code)} />])}
          />
        </Drawer>
      )}
    </div>
  );
}

function Lead({ title, description, action }) { return <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-bold">{title}</h2><p className="text-sm text-slate-400">{description}</p></div>{action}</header>; }
function SearchBox({ placeholder, value = '', onChange = () => {} }) { return <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><Search size={16} className="text-slate-500" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>; }
function ProfileCard({ group, users, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${active ? 'border-sky-400 bg-sky-950/40' : 'border-slate-800 hover:border-sky-700'}`}>
      <span className="rounded-lg bg-sky-950 p-2 text-sky-400"><ShieldCheck /></span>
      <span className="flex-1"><strong className="block text-sm">{group.name}</strong><span className="block text-xs text-slate-500">{group.description || 'Sem descrição'}</span></span>
      <span className="text-right text-xs"><b className="text-sky-400">{group.permission_codes.length}</b> permissões<br /><b className="text-sky-400">{users}</b> usuários</span>
      <ChevronRight size={16} />
    </button>
  );
}
function Title({ icon: Icon, children }) { return <h3 className="flex items-center gap-2 font-bold"><Icon size={18} className="text-sky-400" />{children}</h3>; }
function Count({ children }) { return <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{children}</span>; }
function Badge({ children, active = true }) { return <span className={`rounded-full px-2 py-1 text-[10px] ring-1 ${active ? 'bg-emerald-950 text-emerald-300 ring-emerald-700' : 'bg-rose-950 text-rose-300 ring-rose-700'}`}>{children}</span>; }
function Tag({ children }) { return <span className="rounded-md border border-sky-600 px-3 py-1.5 text-xs text-sky-300">{children}</span>; }
function Empty({ children }) { return <p className="text-xs text-slate-500">{children}</p>; }
function Mini({ label, value }) { return <div className="rounded-lg border border-slate-800 p-3"><strong className="block text-2xl">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>; }
function Action({ children, icon: Icon, onClick }) { return <button type="button" onClick={onClick} className={outline}>{Icon && <Icon className="mr-1 inline" size={14} />} {children}</button>; }
function Unavailable({ children, icon: Icon, primary = false }) {
  const cls = primary ? 'rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950' : outline;
  return <button type="button" disabled title={UNAVAILABLE_REASON} className={`${cls} disabled:cursor-not-allowed disabled:opacity-50`}>{Icon && <Icon className="mr-1 inline" size={primary ? 16 : 14} />}{children}</button>;
}
function Info({ icon: Icon, label, value }) { return <div className="flex gap-3 rounded-lg border border-slate-800 p-3"><Icon className="text-sky-400" /><div><span className="text-xs text-slate-500">{label}</span><strong className="block text-sm">{value}</strong></div></div>; }
function Box({ title, items }) { return <section className={`${panel} p-3`}><h3 className="font-bold">{title}</h3><div className="mt-3 flex flex-wrap gap-2">{items.map((item) => <Tag key={item}>{item}</Tag>)}</div></section>; }
function SimpleTable({ headers, rows }) { return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-sky-950/60"><tr>{headers.map((item) => <th key={item} className="p-2">{item}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-800">{row.map((cell, i) => <td key={i} className="p-2">{cell}</td>)}</tr>)}</tbody></table></div>; }
function PendingHistory({ title }) { return <section className={`${panel} p-3`}><Title icon={FileClock}>{title}</Title><p className="mt-3 text-xs text-slate-500">Histórico por perfil ainda não integrado; as alterações já ficam registradas na auditoria do tenant.</p></section>; }
function Select({ label, value, setValue = () => {}, options }) { return <label className="text-[10px] text-slate-500">{label}<select value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-200">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function Permission({ allowed }) { return <span className={`inline-flex min-w-20 justify-center rounded-md border px-2 py-1 ${allowed ? 'border-emerald-700 bg-emerald-950 text-emerald-300' : 'border-rose-700 bg-rose-950 text-rose-300'}`}>{allowed ? '✓ Permitido' : '× Negado'}</span>; }
function Summary({ value, label, tone }) { const cls = { emerald: 'border-emerald-700 text-emerald-300', sky: 'border-sky-700 text-sky-300', rose: 'border-rose-700 text-rose-300' }[tone]; return <div className={`rounded-lg border p-2 text-center ${cls}`}><strong className="block text-xl">{value}</strong><span className="text-[10px]">{label}</span></div>; }
function Drawer({ title, close, children }) { return <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/55"><aside role="dialog" aria-label={title} className="h-full w-full max-w-xl overflow-y-auto border-l border-sky-800 bg-mm-drawer"><header className="flex items-center justify-between border-b border-slate-800 p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-sky-400">Administração</p><h2 className="text-xl font-bold">{title}</h2></div><button aria-label="Fechar painel" onClick={close}><X /></button></header><div className="p-5">{children}</div></aside></div>; }
function DrawerBody({ type }) { return <div className="space-y-4"><p className="rounded-lg border border-sky-900 bg-sky-950/30 p-3 text-xs text-sky-300">Edição visual local. A integração e persistência serão conectadas na próxima etapa.</p>{type === 'form' ? <div className="space-y-3">{['Nome', 'Descrição', 'Responsável'].map((item) => <label key={item} className="block text-xs text-slate-400">{item}<input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>)}<button className="w-full rounded-lg bg-sky-400 p-3 font-bold text-slate-950">Salvar localmente</button></div> : <div className="space-y-2">{['Resumo e estado', 'Vínculos relacionados', 'Permissões efetivas', 'Histórico recente'].map((item) => <button key={item} className="flex w-full justify-between rounded-xl border border-slate-800 p-4 text-left">{item}<ChevronRight /></button>)}</div>}</div>; }
