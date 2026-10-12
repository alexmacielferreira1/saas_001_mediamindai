import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Trash2 } from "lucide-react";
import {
  getAICompanies,
  getAIConnections,
  saveAIConnections,
} from "../../api/generation";
import { useEmpresa } from "../lib/empresaContext";
import { AI_TOOLS } from "../lib/aiToolsRegistry";

const systemTools = [
  { id: "assistant", label: "Assistente" },
  { id: "transcription", label: "Transcrição" },
  { id: "ocr", label: "Leitura de texto (OCR)" },
  { id: "semantic-search", label: "Busca inteligente" },
  { id: "media-analysis", label: "Análise de mídia" },
  { id: "script-writing", label: "Roteiros" },
  { id: "captions", label: "Legendas" },
  { id: "automation", label: "Automações" },
];
const presets = [
  {
    id: "gpt",
    label: "GPT / OpenAI",
    provider: "compatible",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4.1",
  },
  {
    id: "gpt-image",
    label: "GPT / OpenAI · Imagens",
    provider: "compatible",
    base_url: "https://api.openai.com/v1",
    model: "gpt-image-1",
  },
  {
    id: "claude",
    label: "Claude / Anthropic",
    provider: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    model: "claude-sonnet-5-5",
  },
  {
    id: "custom",
    label: "Outra API compatível",
    provider: "compatible",
    base_url: "",
    model: "",
  },
];
const field =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white";
const panel = "rounded-xl border border-slate-800 bg-slate-950/50 p-5";

function presetId(item) {
  return (
    presets.find(
      (p) =>
        p.base_url === item.base_url &&
        p.model === item.model &&
        p.provider === item.provider,
    )?.id || "custom"
  );
}

export default function AISettings() {
  const { currentEmpresa: sessionCompany, empresas = [] } = useEmpresa();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(sessionCompany?.id || "");
  const [superadmin, setSuperadmin] = useState(false);
  const [config, setConfig] = useState(null);
  const [keys, setKeys] = useState({});
  const [state, setState] = useState({
    loading: false,
    saving: false,
    error: "",
    message: "",
  });
  const scope = useRef(companyId);
  scope.current = companyId;
  const company =
    companies.find((item) => item.id === companyId) ||
    empresas.find((item) => item.id === companyId) ||
    sessionCompany;
  useEffect(() => {
    let active = true;
    getAICompanies()
      .then((value) => {
        if (active) {
          setCompanies(
            value.companies.map((item) => ({ id: item.id, nome: item.name })),
          );
          setSuperadmin(value.is_superadmin);
        }
      })
      .catch((error) => {
        if (active) setState((old) => ({ ...old, error: error.message }));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setConfig(null);
    setKeys({});
    setState({ loading: !!companyId, saving: false, error: "", message: "" });
    if (!companyId) return undefined;
    let active = true;
    getAIConnections(companyId)
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch((error) => {
        if (active) setState((old) => ({ ...old, error: error.message }));
      })
      .finally(() => {
        if (active) setState((old) => ({ ...old, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [companyId]);
  const editable = config?.can_manage && !state.saving;
  function update(id, values) {
    setConfig((old) => ({
      ...old,
      connections: old.connections.map((item) =>
        item.id === id ? { ...item, ...values } : item,
      ),
    }));
  }
  function add() {
    setConfig((old) => ({
      ...old,
      connections: [
        ...old.connections,
        {
          id: crypto.randomUUID(),
          name: "",
          provider: "compatible",
          base_url: "https://api.openai.com/v1",
          model: "gpt-4.1",
          enabled: true,
          key_configured: false,
        },
      ],
    }));
  }
  function remove(id) {
    setConfig((old) => ({
      ...old,
      connections: old.connections.filter((item) => item.id !== id),
      default_connection_id:
        old.default_connection_id === id ? null : old.default_connection_id,
      tool_connections: Object.fromEntries(
        Object.entries(old.tool_connections).filter(
          ([, target]) => target !== id,
        ),
      ),
    }));
    setKeys((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  }
  function choosePreset(item, id) {
    const selected = presets.find((p) => p.id === id);
    update(item.id, {
      provider: selected.provider,
      base_url: selected.base_url,
      model: selected.model,
      key_configured: false,
    });
    setKeys((old) => ({ ...old, [item.id]: "" }));
  }
  function toggleTool(id, toolId, checked) {
    setConfig((old) => ({
      ...old,
      tool_connections: {
        ...old.tool_connections,
        [toolId]: checked ? id : null,
      },
    }));
  }
  function toggleAll(id, checked) {
    setConfig((old) => ({
      ...old,
      default_connection_id: checked ? id : null,
      tool_connections: checked ? {} : old.tool_connections,
    }));
  }
  async function save(event) {
    event.preventDefault();
    const target = companyId;
    setState({ loading: false, saving: true, error: "", message: "" });
    try {
      const saved = await saveAIConnections(
        {
          connections: config.connections.map((item) => ({
            id: item.id,
            name: item.name,
            provider: item.provider,
            base_url: item.base_url,
            model: item.model,
            enabled: item.enabled,
            ...(keys[item.id] ? { api_key: keys[item.id] } : {}),
          })),
          default_connection_id: config.default_connection_id,
          tool_connections: config.tool_connections,
        },
        target,
      );
      if (scope.current !== target) return;
      setConfig(saved);
      setKeys({});
      setState({
        loading: false,
        saving: false,
        error: "",
        message: `Configurações salvas para ${company?.nome || "a empresa"}.`,
      });
    } catch (error) {
      if (scope.current === target)
        setState({
          loading: false,
          saving: false,
          message: "",
          error: error.message,
        });
    }
  }
  return (
    <div className="space-y-5 pb-8 text-slate-300">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sky-400">
            <Bot size={22} />
            <span className="text-xs font-bold uppercase tracking-widest">
              MediaMind · IA
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Configuração de IA</h1>
          <p className="mt-2 text-sm text-slate-400">
            Adicione suas IAs e marque onde usar.
          </p>
        </div>
        <label className="min-w-56 text-xs">
          Empresa
          <select
            className={field}
            aria-label="Configurar empresa"
            value={companyId}
            disabled={state.saving}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            <option value="" disabled>
              Selecione uma empresa
            </option>
            {(companies.length
              ? companies
              : empresas.length
                ? empresas
                : sessionCompany
                  ? [sessionCompany]
                  : []
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      </header>
      {superadmin && (
        <p className="text-xs text-sky-300">
          Superadmin: acesso à configuração de todas as empresas.
        </p>
      )}
      {!companyId && (
        <p className={panel}>Selecione uma empresa para configurar a IA.</p>
      )}
      {state.loading && <p>Carregando…</p>}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300"
        >
          {state.message}
        </p>
      )}
      {config && (
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              As IAs desta empresa são compartilhadas com seus usuários.
            </p>
            {config.can_manage && (
              <button
                type="button"
                disabled={!editable}
                onClick={add}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm text-white"
              >
                <Plus size={16} />
                Adicionar IA
              </button>
            )}
          </div>
          {!config.can_manage && (
            <p className={panel}>A edição exige permissão de administrador.</p>
          )}
          {!config.connections.length && (
            <p className={panel}>
              Nenhuma IA cadastrada. Clique em Adicionar IA.
            </p>
          )}
          {config.connections.map((item, index) => (
            <section
              key={item.id}
              aria-label={`Card de IA ${index + 1}`}
              className={panel}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-white">
                  {item.name || `Nova IA ${index + 1}`}
                </h2>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      disabled={!editable}
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) =>
                        update(item.id, { enabled: event.target.checked })
                      }
                    />
                    Ativa
                  </label>
                  {config.can_manage && (
                    <button
                      type="button"
                      disabled={!editable}
                      aria-label={`Remover conexão ${index + 1}`}
                      onClick={() => remove(item.id)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(240px,.7fr)_minmax(0,1.3fr)]">
                <fieldset disabled={!editable} className="space-y-3">
                  <label className="block text-xs">
                    Nome personalizado
                    <input
                      required
                      aria-label={`Nome da conexão ${index + 1}`}
                      className={field}
                      value={item.name}
                      placeholder="Ex.: IA de roteiros da Acme"
                      onChange={(event) =>
                        update(item.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs">
                    IA / Provedor
                    <select
                      aria-label={`Provedor ${index + 1}`}
                      className={field}
                      value={presetId(item)}
                      onChange={(event) =>
                        choosePreset(item, event.target.value)
                      }
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {config.can_manage && (
                    <label className="block text-xs">
                      Chave da API {item.key_configured && "· cadastrada"}
                      <input
                        required={!item.key_configured}
                        type="password"
                        aria-label={`Chave da API ${index + 1}`}
                        autoComplete="new-password"
                        className={field}
                        value={keys[item.id] || ""}
                        placeholder={
                          item.key_configured
                            ? "Vazio mantém a chave atual"
                            : "Cole a chave"
                        }
                        onChange={(event) =>
                          setKeys((old) => ({
                            ...old,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  <details open={presetId(item) === "custom"}>
                    <summary className="cursor-pointer text-xs text-slate-400">
                      Modelo e endereço · preenchidos automaticamente
                    </summary>
                    <label className="mt-3 block text-xs">
                      Modelo
                      <input
                        required
                        aria-label={`Modelo ${index + 1}`}
                        className={field}
                        value={item.model}
                        onChange={(event) =>
                          update(item.id, { model: event.target.value })
                        }
                      />
                    </label>
                    <label className="mt-3 block text-xs">
                      Endereço da API
                      <input
                        required
                        type="url"
                        aria-label={`Endereço da API ${index + 1}`}
                        className={field}
                        value={item.base_url}
                        onChange={(event) =>
                          update(item.id, {
                            base_url: event.target.value,
                            key_configured: false,
                          })
                        }
                      />
                    </label>
                  </details>
                </fieldset>
                <fieldset
                  disabled={!editable}
                  className="lg:border-l lg:border-slate-800 lg:pl-6"
                >
                  <legend className="mb-3 text-sm font-semibold">
                    Usar esta IA em
                  </legend>
                  <label className="flex items-center gap-2 text-xs text-sky-300">
                    <input
                      type="checkbox"
                      aria-label={`Todas as ferramentas · ${item.name || "Nova IA"}`}
                      checked={config.default_connection_id === item.id}
                      onChange={(event) =>
                        toggleAll(item.id, event.target.checked)
                      }
                    />
                    Todas as ferramentas e IA do sistema
                  </label>
                  {[
                    { label: "Ferramentas de criação", tools: AI_TOOLS },
                    { label: "IA do sistema", tools: systemTools },
                  ].map((group) => (
                    <div
                      key={group.label}
                      className="mt-4 border-t border-slate-800 pt-3"
                    >
                      <h3 className="mb-3 text-xs font-semibold text-slate-400">
                        {group.label}
                      </h3>
                      <div className="flex flex-wrap gap-x-5 gap-y-3">
                        {group.tools.map((tool) => (
                          <label
                            key={tool.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              aria-label={`${tool.label} · ${item.name || "Nova IA"}`}
                              checked={
                                (Object.hasOwn(config.tool_connections, tool.id)
                                  ? config.tool_connections[tool.id]
                                  : config.default_connection_id) === item.id
                              }
                              onChange={(event) =>
                                toggleTool(
                                  item.id,
                                  tool.id,
                                  event.target.checked,
                                )
                              }
                            />
                            {tool.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </fieldset>
              </div>
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-xs text-slate-500">
              Marcar outra IA substitui a anterior naquele recurso. Recursos
              locais continuam gratuitos; o provedor precisa suportar o uso
              escolhido.
            </p>
            {config.can_manage && (
              <button
                disabled={!editable}
                className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {state.saving ? "Salvando…" : "Salvar configurações da empresa"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
