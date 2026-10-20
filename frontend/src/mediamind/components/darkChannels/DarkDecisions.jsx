import { useState } from "react";
import { CheckCircle2, Plus, RotateCcw, Star } from "lucide-react";
import { updateDarkDecision, updateDarkStructure } from "../../../api/darkChannels";

const input = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";
const label = "block text-xs text-slate-300";
const ALL = "all";
export const scopeLabels = { geral: "Geral", nicho: "Nicho", idioma: "Idioma", canal: "Canal" };
const emptyNew = () => ({ title: "", question: "", options: "", scope: "geral", ref: "" });

export const isDecided = (decision) => decision.status === "decidida";

/** Corpo do PUT /dark-channels/structure a partir da estrutura atual. */
export function structureBody(structure, patch = {}) {
  return {
    name: structure?.name || "",
    languages: structure?.languages || [],
    niches: structure?.niches || [],
    decisions: structure?.decisions || [],
    ...patch,
  };
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

function DecisionCard({ decision, busy, onDecide, onReopen }) {
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [notes, setNotes] = useState(decision.notes || "");
  const answer = custom.trim() || selected;
  const options = decision.options || [];
  const decided = isDecided(decision);
  const scopeText = `${scopeLabels[decision.scope] || decision.scope || "Geral"}${decision.ref ? `: ${decision.ref}` : ""}`;

  return (
    <article aria-label={`Decisão: ${decision.title}`} className={`space-y-3 rounded-lg border p-3 ${decided ? "border-slate-800 bg-slate-950/40" : "border-amber-800/70 bg-amber-950/10"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{decision.title}</h3>
          {decision.question && <p className="mt-1 text-sm text-slate-300">{decision.question}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{scopeText}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${decided ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>{decided ? "Decidida" : "Pendente"}</span>
        </div>
      </div>
      {decision.recommendation && <p className="flex items-start gap-1 rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-2 py-1 text-xs text-cyan-200"><Star size={13} className="mt-0.5 shrink-0"/><span><strong>Recomendado:</strong> {decision.recommendation}</span></p>}
      {decided ? <div className="space-y-2">
        <p className="text-sm text-slate-200"><strong className="text-white">Resposta:</strong> {decision.answer}</p>
        <p className="text-xs text-slate-400">{decision.decided_at ? `Decidida em ${formatDate(decision.decided_at)}` : "Decidida"}{decision.notes ? ` · ${decision.notes}` : ""}</p>
        <button type="button" disabled={busy} onClick={() => onReopen(decision)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500 disabled:opacity-50"><RotateCcw size={13}/>Reabrir</button>
      </div> : <div className="space-y-2">
        {!!options.length && <div role="radiogroup" aria-label={`Opções para ${decision.title}`} className="flex flex-wrap gap-2">{options.map((option) => {
          const active = !custom.trim() && selected === option;
          return <button key={option} type="button" role="radio" aria-checked={active} onClick={() => { setSelected(option); setCustom(""); }} className={`rounded-lg border px-3 py-1.5 text-left text-xs ${active ? "border-cyan-500 bg-cyan-950/40 text-cyan-100" : "border-slate-700 text-slate-200 hover:border-slate-500"}`}>{option}{option === decision.recommendation && <span className="ml-2 rounded-full bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">Recomendado</span>}</button>;
        })}</div>}
        <label className={label}>Outra resposta<input aria-label={`Outra resposta para ${decision.title}`} className={`${input} mt-1`} maxLength={500} value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Opcional"/></label>
        <label className={label}>Notas<textarea aria-label={`Notas da decisão ${decision.title}`} className={`${input} mt-1 min-h-16`} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)}/></label>
        <button type="button" disabled={busy || !answer} onClick={() => onDecide(decision, answer, notes.trim())} className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={13}/>Decidir</button>
      </div>}
    </article>
  );
}

export default function DarkDecisions({ structure, onStructureChange }) {
  const [scope, setScope] = useState(ALL);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState(emptyNew);
  const decisions = structure?.decisions || [];
  const pending = decisions.filter((decision) => !isDecided(decision));
  const ordered = [...pending, ...decisions.filter(isDecided)].filter((decision) => scope === ALL || (decision.scope || "geral") === scope);

  async function run(id, action, success) {
    setBusyId(id); setError(""); setNotice("");
    try {
      onStructureChange(await action());
      setNotice(success);
      return true;
    } catch (actionError) {
      setError(actionError.message || "Não foi possível salvar a decisão.");
      return false;
    } finally { setBusyId(""); }
  }

  // O PATCH devolve só a decisão atualizada; ela é mesclada na estrutura local.
  const patchDecision = async (id, body) => {
    const updated = await updateDarkDecision(id, body);
    return { ...structure, decisions: decisions.map((item) => item.id === updated.id ? updated : item) };
  };
  const decide = (decision, answer, notes) => run(decision.id, () => patchDecision(decision.id, { status: "decidida", answer, notes }), `Decisão “${decision.title}” registrada.`);
  const reopen = (decision) => run(decision.id, () => patchDecision(decision.id, { status: "pendente" }), `Decisão “${decision.title}” reaberta.`);

  async function createDecision(event) {
    event.preventDefault();
    const title = draft.title.trim();
    const question = draft.question.trim();
    if (!title || !question) return;
    const decision = {
      id: `dec-${Date.now().toString(36)}`, title, question,
      options: [...new Set(draft.options.split("\n").map((option) => option.trim()).filter(Boolean))],
      recommendation: "", scope: draft.scope, ref: draft.ref.trim(), status: "pendente", answer: "", notes: "", decided_at: null,
    };
    const saved = await run("new", () => updateDarkStructure(structureBody(structure, { decisions: [...decisions, decision] })), `Decisão “${title}” criada.`);
    if (saved) { setDraft(emptyNew()); setShowNew(false); }
  }

  return (
    <section aria-label="Decisões" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-bold text-white">Decisões da rede</h2><p className="text-xs text-slate-400">{pending.length} pendentes · {decisions.length - pending.length} decididas. Pendentes aparecem primeiro.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-300">Escopo<select aria-label="Filtrar decisões por escopo" className={`${input} mt-1 w-auto`} value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value={ALL}>Todos ({decisions.length})</option>
            {Object.entries(scopeLabels).map(([key, text]) => <option key={key} value={key}>{text} ({decisions.filter((decision) => (decision.scope || "geral") === key).length})</option>)}
          </select></label>
          <button type="button" onClick={() => setShowNew((shown) => !shown)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-800 px-3 py-2 text-sm text-cyan-200 hover:border-cyan-500"><Plus size={15}/>Nova decisão</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</p>}
      {showNew && <form aria-label="Nova decisão" onSubmit={createDecision} className="grid gap-2 rounded-lg border border-slate-800 p-3 md:grid-cols-2">
        <label className={label}>Título<input aria-label="Título da decisão" className={`${input} mt-1`} required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>Escopo<select aria-label="Escopo da decisão" className={`${input} mt-1`} value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })}>{Object.entries(scopeLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
          <label className={label}>Referência<input aria-label="Referência da decisão" className={`${input} mt-1`} maxLength={80} value={draft.ref} onChange={(event) => setDraft({ ...draft, ref: event.target.value })} placeholder="Ex.: código do nicho"/></label>
        </div>
        <label className={`${label} md:col-span-2`}>Pergunta<input aria-label="Pergunta da decisão" className={`${input} mt-1`} required maxLength={500} value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })}/></label>
        <label className={`${label} md:col-span-2`}>Opções, uma por linha<textarea aria-label="Opções da decisão" className={`${input} mt-1 min-h-20`} value={draft.options} onChange={(event) => setDraft({ ...draft, options: event.target.value })}/></label>
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">Cancelar</button><button type="submit" disabled={busyId === "new"} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Salvar decisão</button></div>
      </form>}
      {ordered.length ? <div className="grid gap-3 lg:grid-cols-2">{ordered.map((decision) => <DecisionCard key={`${decision.id}:${decision.status}`} decision={decision} busy={!!busyId} onDecide={decide} onReopen={reopen}/>)}</div>
        : <p className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-400">{decisions.length ? "Nenhuma decisão neste escopo." : "Nenhuma decisão registrada. Aplique um modelo em “Estrutura” ou crie uma nova decisão."}</p>}
    </section>
  );
}
