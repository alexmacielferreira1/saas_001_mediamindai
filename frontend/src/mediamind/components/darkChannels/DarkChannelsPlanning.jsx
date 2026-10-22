import { useEffect, useState } from "react";
import { Plus, Save, Tag } from "lucide-react";
import { createDarkChannel, updateDarkChannel } from "../../../api/darkChannels";
import { isDecided } from "./DarkDecisions";

const input = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";
const panel = "rounded-xl border border-slate-800 bg-slate-950/60 p-4";
const label = "block text-xs text-slate-300";
const CUSTOM_OPTION = "__custom__";
export const ALL = "all";
const DEFAULT_LANGUAGE = "pt-BR";
const EXTERNAL_ID_PATTERN = "[a-z0-9][a-z0-9\\-]{0,79}";

export const lifecycleLabels = {
  ideia: "Ideia", planejado: "Planejado", implementacao: "Em implementação", lancamento: "Em lançamento",
  ativo: "Ativo", pausado: "Pausado", em_espera: "Em espera", arquivado: "Arquivado",
};
const lifecycleBadge = {
  ativo: "bg-emerald-950 text-emerald-300", pausado: "bg-amber-950 text-amber-300", em_espera: "bg-amber-950 text-amber-300",
  arquivado: "bg-slate-800 text-slate-300",
};
const platformLabels = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };
const formatLabels = { long: "Vídeos longos", shorts: "Shorts", both: "Longos e Shorts" };
export const emptyFilters = { niche: ALL, language: ALL, status: ALL, query: "" };
const PLACEHOLDER_PREFIX = "[A DEFINIR]";
const isPlaceholderName = (name) => String(name || "").trim().toUpperCase().startsWith(PLACEHOLDER_PREFIX);

const emptyPlanning = () => ({ lifecycle_status: "ativo", launch_wave: "", weekly_target: "0", target_platforms: [], alt_names: "", notes: "", topic_folders: "" });
const emptyForm = () => ({
  name: "", external_id: "", niche: "", niche_code: "", subniche: "", audience: "", language: DEFAULT_LANGUAGE, regional_frame: "",
  format: "long", publishing_mode: "manual", ...emptyPlanning(),
});
const splitList = (value) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
const channelLanguage = (channel) => channel.language || DEFAULT_LANGUAGE;
const channelStatus = (channel) => channel.lifecycle_status || "ativo";
const channelName = (channel) => String(channel.name || "");
const channelNicheKey = (channel) => channel.niche_code || channel.niche || "";
const subnicheName = (subniche) => typeof subniche === "string" ? subniche : subniche?.name || subniche?.code || "";
const planningFromChannel = (channel) => ({
  lifecycle_status: channelStatus(channel), launch_wave: channel.launch_wave != null ? String(channel.launch_wave) : "",
  weekly_target: String(channel.weekly_target ?? 0), target_platforms: channel.target_platforms || [],
  alt_names: (channel.alt_names || []).join(", "), notes: channel.notes || "", topic_folders: (channel.topic_folders || []).join(", "),
});

/** Converte os campos de planejamento do formulário no formato aceito pela API. */
export function planningPayload(draft) {
  const payload = {
    lifecycle_status: draft.lifecycle_status,
    weekly_target: Math.max(0, Number.parseInt(draft.weekly_target, 10) || 0),
    target_platforms: draft.target_platforms,
    alt_names: splitList(draft.alt_names),
    notes: draft.notes.trim(),
    topic_folders: splitList(draft.topic_folders),
  };
  const wave = Number.parseInt(draft.launch_wave, 10);
  if (wave > 0) payload.launch_wave = wave;
  return payload;
}

function countBy(items, keyOf, labelOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const current = groups.get(key) || { key, label: labelOf(item), count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-BR"));
}

/** Visão derivada da rede: canais visíveis, rótulos de nicho/idioma e agrupamentos usados no resumo e nos filtros. */
export function networkView(channels, structure) {
  const languages = structure?.languages || [];
  const niches = structure?.niches || [];
  const visible = channels.filter((channel) => !channel.archived);
  const nicheLabel = (channel) => niches.find((niche) => niche.code === channel.niche_code)?.name || channel.niche || "Sem nicho";
  const languageLabel = (code) => { const language = languages.find((item) => item.code === code); return language ? `${language.name} (${code})` : code; };
  return {
    languages, niches, visible, nicheLabel, languageLabel,
    byNiche: countBy(visible, channelNicheKey, nicheLabel),
    byLanguage: countBy(visible, channelLanguage, (channel) => languageLabel(channelLanguage(channel))),
    byStatus: countBy(visible, channelStatus, (channel) => lifecycleLabels[channelStatus(channel)] || channelStatus(channel)),
    pendingDecisions: (structure?.decisions || []).filter((decision) => !isDecided(decision)).length,
  };
}

function PlanningFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return <>
    <div className="grid grid-cols-3 gap-2">
      <label className={label}>Status<select aria-label="Status do canal" className={`${input} mt-1`} value={value.lifecycle_status} onChange={(event) => set({ lifecycle_status: event.target.value })}>{Object.entries(lifecycleLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label className={label}>Onda<input aria-label="Onda de lançamento" className={`${input} mt-1`} type="number" min={1} max={99} value={value.launch_wave} onChange={(event) => set({ launch_wave: event.target.value })} placeholder="—"/></label>
      <label className={label}>Meta semanal<input aria-label="Meta semanal de vídeos" className={`${input} mt-1`} type="number" min={0} max={100} value={value.weekly_target} onChange={(event) => set({ weekly_target: event.target.value })}/></label>
    </div>
    <fieldset className="space-y-1"><legend className="text-xs text-slate-300">Plataformas</legend><div className="flex flex-wrap gap-3">{Object.entries(platformLabels).map(([key, text]) => <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={value.target_platforms.includes(key)} onChange={(event) => set({ target_platforms: event.target.checked ? [...value.target_platforms, key] : value.target_platforms.filter((item) => item !== key) })}/>{text}</label>)}</div></fieldset>
    <label className={label}>Nomes alternativos, separados por vírgulas<input aria-label="Nomes alternativos" className={`${input} mt-1`} value={value.alt_names} onChange={(event) => set({ alt_names: event.target.value })} placeholder="Opcional"/></label>
    <label className={label}>Pastas de tema, separadas por vírgulas<input aria-label="Pastas de tema" className={`${input} mt-1`} value={value.topic_folders} onChange={(event) => set({ topic_folders: event.target.value })} placeholder="Ex.: Biografias, Curiosidades"/></label>
    <label className={`${label} md:col-span-2`}>Notas<textarea aria-label="Notas do canal" className={`${input} mt-1 min-h-20`} maxLength={2000} value={value.notes} onChange={(event) => set({ notes: event.target.value })}/></label>
  </>;
}

function SummaryList({ title, items, onPick }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 p-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="mt-2 space-y-1">{items.map((item) => <li key={item.key}><button type="button" aria-label={`Filtrar ${title.toLowerCase()} ${item.label}`} onClick={() => onPick(item.key)} className="flex w-full items-center justify-between gap-2 rounded px-1 text-left text-sm text-slate-200 hover:bg-slate-800"><span className="truncate">{item.label}</span><span className="text-xs font-bold text-cyan-300">{item.count}</span></button></li>)}</ul>
    </div>
  );
}

/** Resumo da rede: blocos de contagem (incluindo decisões pendentes) e distribuição por nicho, idioma e status. */
export function DarkNetworkSummary({ network, onOpenDecisions, onFilter }) {
  const { visible, pendingDecisions } = network;
  const inLaunch = visible.filter((channel) => ["implementacao", "lancamento"].includes(channelStatus(channel))).length;
  const weeklyTotal = visible.reduce((total, channel) => total + (Number(channel.weekly_target) || 0), 0);
  return (
    <section aria-label="Resumo da rede" className={`${panel} space-y-3`}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <button type="button" onClick={onOpenDecisions} className={`rounded-lg border p-3 text-left ${pendingDecisions ? "border-amber-800/70 bg-amber-950/10 hover:border-amber-600" : "border-slate-800 hover:border-slate-600"}`}><p className="text-xs text-slate-400">Decisões pendentes</p><p className={`text-2xl font-black ${pendingDecisions ? "text-amber-300" : "text-white"}`}>{pendingDecisions}</p></button>
        {[["Canais", visible.length], ["Ativos", visible.filter((channel) => channelStatus(channel) === "ativo").length], ["Em implementação ou lançamento", inLaunch], ["Meta semanal total", weeklyTotal]].map(([title, value]) => <div key={title} className="rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-400">{title}</p><p className="text-2xl font-black text-white">{value}</p></div>)}
      </div>
      {visible.length > 0 && <div className="grid gap-2 md:grid-cols-3">
        <SummaryList title="Nicho" items={network.byNiche} onPick={(key) => onFilter({ ...emptyFilters, niche: key })}/>
        <SummaryList title="Idioma" items={network.byLanguage} onPick={(key) => onFilter({ ...emptyFilters, language: key })}/>
        <SummaryList title="Status" items={network.byStatus} onPick={(key) => onFilter({ ...emptyFilters, status: key })}/>
      </div>}
    </section>
  );
}

/**
 * Aba "Canais" do Canais Dark: cadastro com idioma/nicho/subnicho e planejamento, filtros, cartões ordenados
 * e detalhes do canal selecionado. A seleção é controlada pela página e compartilhada com as etapas do pipeline.
 */
export default function DarkChannelsPlanning({
  network, loading, filters, onFiltersChange, selectedId, onSelect, showForm, onCloseForm,
  saving, onSavingChange, onError, onNotice, onChannelCreated, onChannelUpdated, detailActions, detailOverview,
}) {
  const [form, setForm] = useState(emptyForm);
  const [nicheCustom, setNicheCustom] = useState(false);
  const [languageCustom, setLanguageCustom] = useState(false);
  const [planning, setPlanning] = useState(emptyPlanning);
  const { languages, niches, visible, nicheLabel, languageLabel } = network;
  const languageOptions = languages.some((language) => language.code === DEFAULT_LANGUAGE) ? languages : [{ code: DEFAULT_LANGUAGE, name: "Português (Brasil)" }, ...languages];
  const selectedNiche = niches.find((niche) => niche.code === form.niche_code) || null;
  const selected = visible.find((channel) => channel.id === selectedId) || null;
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  const filtered = visible.filter((channel) => (filters.niche === ALL || channelNicheKey(channel) === filters.niche)
    && (filters.language === ALL || channelLanguage(channel) === filters.language)
    && (filters.status === ALL || channelStatus(channel) === filters.status)
    && (!query || [channel.name, channel.external_id, ...(channel.alt_names || [])].some((text) => String(text || "").toLocaleLowerCase("pt-BR").includes(query))));
  const sortedChannels = [...filtered].sort((left, right) => (left.launch_wave ?? Infinity) - (right.launch_wave ?? Infinity)
    || nicheLabel(left).localeCompare(nicheLabel(right), "pt-BR")
    || channelName(left).localeCompare(channelName(right), "pt-BR"));

  useEffect(() => { if (selected) setPlanning(planningFromChannel(selected)); }, [selectedId, selected?.updated_at]);

  function chooseLanguage(code) {
    const custom = code === CUSTOM_OPTION;
    setLanguageCustom(custom);
    const language = languages.find((item) => item.code === code);
    setForm({ ...form, language: custom ? "" : code, regional_frame: language?.regional_frame || "" });
  }

  function chooseNiche(code) {
    setNicheCustom(code === CUSTOM_OPTION);
    setForm({ ...form, niche_code: code === CUSTOM_OPTION ? "" : code, subniche: "" });
  }

  async function submitChannel(event) {
    event.preventDefault();
    const nicheName = selectedNiche ? selectedNiche.name : form.niche.trim();
    if (!form.name.trim() || !nicheName || saving) return;
    onSavingChange(true); onError(""); onNotice("");
    const body = {
      name: form.name.trim(), niche: nicheName, audience: form.audience.trim(), language: form.language.trim() || DEFAULT_LANGUAGE,
      format: form.format, publishing_mode: form.publishing_mode, ...planningPayload(form),
    };
    if (form.external_id.trim()) body.external_id = form.external_id.trim();
    if (form.regional_frame.trim()) body.regional_frame = form.regional_frame.trim();
    if (selectedNiche) body.niche_code = selectedNiche.code;
    if (selectedNiche && form.subniche) body.subniche = form.subniche;
    try {
      const created = await createDarkChannel(body);
      setForm(emptyForm()); setNicheCustom(false); setLanguageCustom(false);
      onChannelCreated(created);
      onNotice(`Canal “${created.name}” criado.`);
    } catch (saveError) { onError(saveError.message || "Não foi possível criar o canal."); }
    finally { onSavingChange(false); }
  }

  async function savePlanning(event) {
    event.preventDefault();
    if (!selected || saving) return;
    onSavingChange(true); onError(""); onNotice("");
    try {
      const updated = await updateDarkChannel(selected.id, planningPayload(planning));
      onChannelUpdated(updated);
      setPlanning(planningFromChannel(updated));
      onNotice("Planejamento do canal salvo.");
    } catch (saveError) { onError(saveError.message || "Não foi possível salvar o planejamento."); }
    finally { onSavingChange(false); }
  }

  async function adoptAltName(altName) {
    const previous = selected.name;
    const altNames = selected.alt_names.filter((name) => name !== altName);
    if (!isPlaceholderName(previous) && !altNames.includes(previous)) altNames.push(previous);
    onSavingChange(true); onError(""); onNotice("");
    try {
      const updated = await updateDarkChannel(selected.id, { name: altName, alt_names: altNames });
      onChannelUpdated(updated);
      setPlanning(planningFromChannel(updated));
      onNotice(`Canal renomeado para “${updated.name}”.`);
    } catch (saveError) { onError(saveError.message || "Não foi possível renomear o canal."); }
    finally { onSavingChange(false); }
  }

  const filterSelect = (key, title, options) => (
    <label className="text-xs text-slate-300">{title}<select aria-label={`Filtrar por ${title.toLowerCase()}`} className={`${input} mt-1 w-auto`} value={filters[key]} onChange={(event) => onFiltersChange({ ...filters, [key]: event.target.value })}>
      <option value={ALL}>Todos ({visible.length})</option>
      {options.map((option) => <option key={option.key} value={option.key}>{option.label} ({option.count})</option>)}
      {filters[key] !== ALL && !options.some((option) => option.key === filters[key]) && <option value={filters[key]}>{filters[key]} (0)</option>}
    </select></label>
  );

  return (
    <>
      {showForm && <form aria-label="Novo canal" onSubmit={submitChannel} className={`${panel} grid gap-3 md:grid-cols-2`}>
        <h2 className="font-bold text-white md:col-span-2">Novo canal</h2>
        <label className={label}>Nome do canal<input aria-label="Nome do canal" className={`${input} mt-1`} maxLength={120} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Histórias sem rosto"/></label>
        <label className={label}>Código do canal (opcional)<input aria-label="Código do canal" className={`${input} mt-1`} maxLength={80} pattern={EXTERNAL_ID_PATTERN} title="Use letras minúsculas, números e hífens." value={form.external_id} onChange={(event) => setForm({ ...form, external_id: event.target.value.toLowerCase() })} placeholder="Ex.: hist-pt-01"/></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>Idioma<select aria-label="Idioma do canal" className={`${input} mt-1`} value={languageCustom ? CUSTOM_OPTION : form.language} onChange={(event) => chooseLanguage(event.target.value)}>{languageOptions.map((language) => <option key={language.code} value={language.code}>{language.name ? `${language.name} (${language.code})` : language.code}</option>)}<option value={CUSTOM_OPTION}>Outro (digitar código)</option></select></label>
          {languageCustom ? <label className={label}>Código do idioma<input aria-label="Código do idioma" className={`${input} mt-1`} minLength={2} maxLength={24} required value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} placeholder="Ex.: es-MX"/></label>
            : <label className={label}>Recorte regional<input aria-label="Recorte regional" className={`${input} mt-1`} maxLength={40} value={form.regional_frame} onChange={(event) => setForm({ ...form, regional_frame: event.target.value })} placeholder="Opcional"/></label>}
        </div>
        {niches.length ? <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>Nicho do canal<select aria-label="Nicho do canal" className={`${input} mt-1`} required value={nicheCustom ? CUSTOM_OPTION : form.niche_code} onChange={(event) => chooseNiche(event.target.value)}><option value="">Selecione</option>{niches.map((niche) => <option key={niche.code} value={niche.code}>{niche.name}</option>)}<option value={CUSTOM_OPTION}>Outro (digitar)</option></select></label>
          {nicheCustom ? <label className={label}>Outro nicho<input aria-label="Outro nicho" className={`${input} mt-1`} maxLength={120} required value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })} placeholder="Ex.: curiosidades"/></label>
            : !!selectedNiche?.subniches?.length && <label className={label}>Subnicho<select aria-label="Subnicho do canal" className={`${input} mt-1`} value={form.subniche} onChange={(event) => setForm({ ...form, subniche: event.target.value })}><option value="">Nenhum (opcional)</option>{selectedNiche.subniches.map(subnicheName).filter(Boolean).map((subniche) => <option key={subniche} value={subniche}>{subniche}</option>)}</select></label>}
        </div> : <label className={label}>Nicho do canal<input aria-label="Nicho do canal" className={`${input} mt-1`} maxLength={120} required value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })} placeholder="Ex.: história, ciência, curiosidades"/></label>}
        <label className={label}>Público-alvo<input aria-label="Público-alvo" className={`${input} mt-1`} maxLength={240} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} placeholder="Opcional"/></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>Formato<select aria-label="Formato do canal" className={`${input} mt-1`} value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}><option value="long">Vídeos longos</option><option value="shorts">Shorts</option><option value="both">Ambos</option></select></label>
          <label className={label}>Publicação<select aria-label="Modo de publicação" className={`${input} mt-1`} value={form.publishing_mode} onChange={(event) => setForm({ ...form, publishing_mode: event.target.value })}><option value="manual">Manual</option><option value="automatic">Automática</option></select></label>
        </div>
        <PlanningFields value={form} onChange={(next) => setForm(next)}/>
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={onCloseForm} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Plus size={16} className="mr-1 inline"/>Criar canal</button></div>
      </form>}

      <section aria-label="Canais da rede" className={`${panel} space-y-3`}>
        <div role="group" aria-label="Filtros de canais" className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-300">Buscar<input aria-label="Buscar canal" className={`${input} mt-1 w-56`} value={filters.query} onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} placeholder="Nome, código ou nome alternativo"/></label>
          {filterSelect("niche", "Nicho", network.byNiche)}
          {filterSelect("language", "Idioma", network.byLanguage)}
          {filterSelect("status", "Status", network.byStatus)}
          <p className="pb-2 text-xs text-slate-500">Mostrando {filtered.length} de {visible.length} canais</p>
        </div>
        {loading ? <p className="text-sm text-slate-400">Carregando canais…</p> : filtered.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{sortedChannels.map((channel) => <button key={channel.id} type="button" aria-pressed={channel.id === selectedId} onClick={() => onSelect(channel.id)} className={`rounded-lg border p-3 text-left ${channel.id === selectedId ? "border-cyan-500 bg-cyan-950/30" : "border-slate-800 hover:border-slate-600"}`}>
          <span className="block font-semibold text-white">{channel.name}</span>
          {isPlaceholderName(channel.name) && <span className="mt-1 inline-block rounded-full border border-amber-800 px-2 py-0.5 text-[10px] font-semibold text-amber-300">nome a definir</span>}
          {channel.external_id && <span className="block truncate text-[10px] text-slate-500">{channel.external_id}</span>}
          <span className="mt-1 block text-xs text-slate-400">{nicheLabel(channel)}{channel.subniche ? ` / ${channel.subniche}` : ""} · {formatLabels[channel.format] || formatLabels.long}</span>
          <span className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{channelLanguage(channel)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${lifecycleBadge[channelStatus(channel)] || "bg-cyan-950 text-cyan-300"}`}>{lifecycleLabels[channelStatus(channel)] || channelStatus(channel)}</span>
            {channel.launch_wave != null && <span className="rounded-full border border-cyan-900 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">Onda {channel.launch_wave}</span>}
            {!!channel.weekly_target && <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{channel.weekly_target}/semana</span>}
          </span>
        </button>)}</div> : visible.length ? <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-400"><span>Nenhum canal corresponde aos filtros.</span><button type="button" onClick={() => onFiltersChange(emptyFilters)} className="text-cyan-300 underline">Limpar filtros</button></div>
          : <p className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-400">Nenhum canal cadastrado ainda. Crie um canal ou aplique um modelo em “Estrutura”.</p>}
      </section>

      {selected && <section aria-label="Detalhes do canal" className={`${panel} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-white">{selected.name}</h2>
            <p className="text-xs text-slate-400">{nicheLabel(selected)}{selected.subniche ? ` / ${selected.subniche}` : ""} · {languageLabel(channelLanguage(selected))}{selected.regional_frame ? ` · ${selected.regional_frame}` : ""} · {formatLabels[selected.format] || formatLabels.long}{selected.external_id ? ` · ${selected.external_id}` : ""}</p>
            {!!(selected.target_platforms || []).length && <p className="mt-1 text-xs text-slate-400">Plataformas: {selected.target_platforms.map((key) => platformLabels[key] || key).join(", ")}</p>}
            {!!(selected.alt_names || []).length && <div role="group" aria-label="Nomes alternativos do canal" className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">{isPlaceholderName(selected.name) ? "Escolha o nome:" : "Nomes alternativos:"}</span>{selected.alt_names.map((altName) => <span key={altName} className="inline-flex items-center gap-1 rounded-full border border-slate-700 py-0.5 pl-2 pr-1 text-xs text-slate-200">{altName}<button type="button" aria-label={`Usar “${altName}” como nome`} disabled={saving} onClick={() => void adoptAltName(altName)} className="inline-flex items-center gap-1 rounded-full bg-cyan-950 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-900 disabled:opacity-50"><Tag size={11}/>Usar como nome</button></span>)}</div>}
          </div>
          {detailActions}
        </div>
        {detailOverview}
        <form aria-label="Planejamento do canal" onSubmit={savePlanning} className="grid gap-3 border-t border-slate-800 pt-3 md:grid-cols-2">
          <h3 className="font-semibold text-white md:col-span-2">Planejamento</h3>
          <PlanningFields value={planning} onChange={setPlanning}/>
          <div className="flex justify-end md:col-span-2"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Save size={15}/>Salvar planejamento</button></div>
        </form>
      </section>}
    </>
  );
}
