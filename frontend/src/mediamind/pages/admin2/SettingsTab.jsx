import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { getAdminSettings, updateAdminSettings } from '../../../api/admin';
import { PageLead, StatusLine } from '../../components/admin2/ui/AdminBlocks';
import { Badge, Button, EmptyState, Loading, Panel } from '../../ui';

const ADMIN_DEMO_SETTINGS_KEY = 'mediamind_admin_demo_settings_v1';
const ADMIN_DEMO_SETTINGS = {
  organization_name: 'MediaMind AI',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  date_format: 'DD/MM/YYYY',
};
const SECTIONS = ['Identidade', 'Localização', 'Aparência', 'Notificações', 'Governança'];

function readDemoSettings() {
  try { return { ...ADMIN_DEMO_SETTINGS, ...JSON.parse(window.localStorage.getItem(ADMIN_DEMO_SETTINGS_KEY) || '{}') }; }
  catch { return { ...ADMIN_DEMO_SETTINGS }; }
}

export default function SettingsTab({ localDemo = false }) {
  const [section, setSection] = useState('Identidade');
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });
  useEffect(() => {
    if (localDemo) {
      setForm(readDemoSettings());
      setState((old) => ({ ...old, loading: false }));
      return undefined;
    }
    let active = true;
    getAdminSettings()
      .then((value) => {
        if (active) { setForm(value); setState((old) => ({ ...old, loading: false })); }
      })
      .catch((reason) => {
        if (!active) return;
        setState({
          loading: false,
          saving: false,
          success: '',
          error: reason.status === 401
            ? 'Entre com uma sessão real para editar as configurações do tenant.'
            : 'Não foi possível carregar as configurações.',
        });
      });
    return () => { active = false; };
  }, []);
  async function save() {
    setState((old) => ({ ...old, saving: true, error: '', success: '' }));
    if (localDemo) {
      window.localStorage.setItem(ADMIN_DEMO_SETTINGS_KEY, JSON.stringify(form));
      setState({ loading: false, saving: false, error: '', success: 'Configurações locais salvas.' });
      return;
    }
    try {
      const updated = await updateAdminSettings(form);
      setForm(updated);
      setState({ loading: false, saving: false, error: '', success: 'Configurações salvas e auditadas.' });
    } catch (reason) {
      setState({ loading: false, saving: false, success: '', error: reason.message || 'Não foi possível salvar as configurações.' });
    }
  }
  const change = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));
  return (
    <div className="space-y-4">
      <PageLead
        title="Configurações administrativas"
        description="Parâmetros organizacionais com autorização, validação, persistência e auditoria por tenant."
        action={<Button onClick={save} disabled={!form || state.saving}>{state.saving ? 'Salvando...' : 'Salvar configurações'}</Button>}
      />
      {state.error && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{state.error}</div>}
      {state.success && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">{state.success}</div>}
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Panel title="Seções">
          <div className="space-y-2">
            {SECTIONS.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setSection(item)}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${section === item ? 'border-sky-500 bg-sky-950/30 text-sky-200' : 'border-slate-800 text-slate-400 hover:border-sky-800'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Identidade da organização" right={<Badge tone={form ? 'success' : 'pending'}>{form ? 'Conectada' : 'Sem sessão'}</Badge>}>
            {state.loading ? <Loading label="Carregando configurações..." /> : form ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <EditableField label="Nome da organização" value={form.organization_name} onChange={change('organization_name')} />
                <EditableField label="Idioma" value={form.locale} onChange={change('locale')} />
                <EditableField label="Fuso horário" value={form.timezone} onChange={change('timezone')} />
                <label className="text-xs text-slate-500">
                  Formato de data
                  <select
                    aria-label="Formato de data"
                    value={form.date_format}
                    onChange={change('date_format')}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  >
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </label>
              </div>
            ) : (
              <EmptyState
                icon={LockKeyhole}
                title="Sessão administrativa necessária"
                description="A edição não usa dados simulados e exige uma sessão autenticada com permissão de gerenciamento."
              />
            )}
          </Panel>
          <Panel title={`${section} · governança`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatusLine label="Escopo" value="Tenant selecionado" />
              <StatusLine label="Autorização" value="permissions.manage" />
              <StatusLine label="Validação" value="Servidor" />
              <StatusLine label="Auditoria" value="settings.updated" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function EditableField({ label, value, onChange }) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      <input
        required
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
      />
    </label>
  );
}
