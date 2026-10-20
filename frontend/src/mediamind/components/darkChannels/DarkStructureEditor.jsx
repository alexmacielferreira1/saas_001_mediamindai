import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { updateDarkStructure } from "../../../api/darkChannels";
import { structureBody } from "./DarkDecisions";

const cell = "w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-cyan-500";
const th = "px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500";
export const nicheStatusLabels = { ativo: "Ativo", planejado: "Planejado", ideia: "Ideia", em_espera: "Em espera" };
export const regionalFrameLabels = {
  "": "Nenhum", aberto: "Aberto", aberto_curado: "Aberto curado", sabedoria_compartilhada: "Sabedoria compartilhada", fora_do_nicho_religioso: "Fora do nicho religioso",
};

let rowCounter = 0;
const nextKey = () => `row-${(rowCounter += 1)}`;

function rowsFromStructure(structure) {
  return {
    niches: (structure?.niches || []).map((niche) => ({ ...niche, _key: nextKey(), priority: String(niche.priority ?? 0), subniches: (niche.subniches || []).join(", "), status: niche.status || "", notes: niche.notes || "" })),
    languages: (structure?.languages || []).map((language) => ({ ...language, _key: nextKey(), regional_frame: language.regional_frame || "", launch_wave: language.launch_wave != null ? String(language.launch_wave) : "", enabled: language.enabled !== false })),
  };
}

const comparable = (draft) => JSON.stringify({
  niches: draft.niches.map(({ _key, ...row }) => row),
  languages: draft.languages.map(({ _key, ...row }) => row),
});

/** Lista mensagens de validação: códigos vazios, nomes vazios e códigos repetidos. */
export function validateDraft(draft) {
  const problems = [];
  for (const [kind, rows] of [["nicho", draft.niches], ["idioma", draft.languages]]) {
    const seen = new Set();
    rows.forEach((row, index) => {
      const code = row.code.trim().toLowerCase();
      if (!code || !row.name.trim()) problems.push(`Preencha código e nome do ${kind} na linha ${index + 1}.`);
      else if (seen.has(code)) problems.push(`Código de ${kind} repetido: ${row.code.trim()}.`);
      seen.add(code);
    });
  }
  return problems;
}

function toPayload(draft) {
  return {
    niches: draft.niches.map(({ _key, ...row }) => ({
      ...row, code: row.code.trim(), name: row.name.trim(), notes: row.notes.trim(), status: row.status,
      priority: Math.max(0, Number.parseInt(row.priority, 10) || 0),
      subniches: [...new Set(row.subniches.split(",").map((item) => item.trim()).filter(Boolean))],
    })),
    languages: draft.languages.map(({ _key, ...row }) => {
      const wave = Number.parseInt(row.launch_wave, 10);
      return { ...row, code: row.code.trim(), name: row.name.trim(), launch_wave: wave > 0 ? wave : null };
    }),
  };
}

export default function DarkStructureEditor({ structure, onStructureChange, onDirtyChange }) {
  const [draft, setDraft] = useState(() => rowsFromStructure(structure));
  const [baseline, setBaseline] = useState(() => comparable(draft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = comparable(draft) !== baseline;
  const problems = useMemo(() => validateDraft(draft), [draft]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (dirtyRef.current) return;
    const rows = rowsFromStructure(structure);
    setDraft(rows);
    setBaseline(comparable(rows));
  }, [structure]);

  const patchRow = (kind, key, patch) => setDraft((current) => ({ ...current, [kind]: current[kind].map((row) => row._key === key ? { ...row, ...patch } : row) }));
  const removeRow = (kind, key) => setDraft((current) => ({ ...current, [kind]: current[kind].filter((row) => row._key !== key) }));
  const addNiche = () => setDraft((current) => ({ ...current, niches: [...current.niches, { _key: nextKey(), code: "", name: "", status: "planejado", priority: "0", subniches: "", notes: "" }] }));
  const addLanguage = () => setDraft((current) => ({ ...current, languages: [...current.languages, { _key: nextKey(), code: "", name: "", regional_frame: "", launch_wave: "", enabled: true }] }));

  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await updateDarkStructure(structureBody(structure, toPayload(draft)));
      const rows = rowsFromStructure(saved);
      setDraft(rows);
      setBaseline(comparable(rows));
      onStructureChange(saved);
      setNotice("Estrutura salva.");
    } catch (saveError) {
      setError(saveError.message || "Não foi possível salvar a estrutura.");
    } finally { setSaving(false); }
  }

  return (
    <section aria-label="Nichos e idiomas" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-bold text-white">Nichos e idiomas</h2><p className="text-xs text-slate-400">Edite a estrutura usada no cadastro e nos filtros. As mudanças só valem depois de salvar.</p></div>
        <button type="button" disabled={!dirty || saving || !!problems.length} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"><Save size={15}/>{saving ? "Salvando…" : "Salvar estrutura"}</button>
      </div>
      {dirty && <p className="rounded-lg border border-amber-800 bg-amber-950/20 p-2 text-xs text-amber-200">Há alterações não salvas em nichos e idiomas.</p>}
      {!!problems.length && <ul aria-label="Problemas na estrutura" className="list-disc rounded-lg border border-rose-800 bg-rose-950/30 p-2 pl-6 text-xs text-rose-200">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Nichos ({draft.niches.length})</h3><button type="button" onClick={addNiche} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-cyan-500"><Plus size={13}/>Adicionar nicho</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-separate border-spacing-y-1" aria-label="Tabela de nichos">
          <thead><tr><th className={th}>Código</th><th className={th}>Nome</th><th className={th}>Status</th><th className={th}>Prioridade</th><th className={th}>Subnichos (vírgulas)</th><th className={th}>Notas</th><th className={th}><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{draft.niches.map((row, index) => <tr key={row._key}>
            <td className="w-24 px-1"><input aria-label={`Código do nicho ${index + 1}`} className={cell} maxLength={12} value={row.code} onChange={(event) => patchRow("niches", row._key, { code: event.target.value })}/></td>
            <td className="px-1"><input aria-label={`Nome do nicho ${index + 1}`} className={cell} maxLength={120} value={row.name} onChange={(event) => patchRow("niches", row._key, { name: event.target.value })}/></td>
            <td className="w-32 px-1"><select aria-label={`Status do nicho ${index + 1}`} className={cell} value={row.status} onChange={(event) => patchRow("niches", row._key, { status: event.target.value })}>{!(row.status in nicheStatusLabels) && <option value={row.status}>{row.status || "—"}</option>}{Object.entries(nicheStatusLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></td>
            <td className="w-20 px-1"><input aria-label={`Prioridade do nicho ${index + 1}`} className={cell} type="number" min={0} max={99} value={row.priority} onChange={(event) => patchRow("niches", row._key, { priority: event.target.value })}/></td>
            <td className="px-1"><input aria-label={`Subnichos do nicho ${index + 1}`} className={cell} value={row.subniches} onChange={(event) => patchRow("niches", row._key, { subniches: event.target.value })}/></td>
            <td className="px-1"><input aria-label={`Notas do nicho ${index + 1}`} className={cell} maxLength={500} value={row.notes} onChange={(event) => patchRow("niches", row._key, { notes: event.target.value })}/></td>
            <td className="w-8 px-1"><button type="button" aria-label={`Remover nicho ${index + 1}`} onClick={() => removeRow("niches", row._key)} className="rounded p-1 text-slate-400 hover:text-rose-300"><Trash2 size={14}/></button></td>
          </tr>)}</tbody>
        </table></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Idiomas ({draft.languages.length})</h3><button type="button" onClick={addLanguage} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-cyan-500"><Plus size={13}/>Adicionar idioma</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-separate border-spacing-y-1" aria-label="Tabela de idiomas">
          <thead><tr><th className={th}>Código</th><th className={th}>Nome</th><th className={th}>Recorte regional</th><th className={th}>Onda</th><th className={th}>Ativo</th><th className={th}><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{draft.languages.map((row, index) => <tr key={row._key}>
            <td className="w-24 px-1"><input aria-label={`Código do idioma ${index + 1}`} className={cell} maxLength={24} value={row.code} onChange={(event) => patchRow("languages", row._key, { code: event.target.value })}/></td>
            <td className="px-1"><input aria-label={`Nome do idioma ${index + 1}`} className={cell} maxLength={80} value={row.name} onChange={(event) => patchRow("languages", row._key, { name: event.target.value })}/></td>
            <td className="w-52 px-1"><select aria-label={`Recorte regional do idioma ${index + 1}`} className={cell} value={row.regional_frame} onChange={(event) => patchRow("languages", row._key, { regional_frame: event.target.value })}>{!(row.regional_frame in regionalFrameLabels) && <option value={row.regional_frame}>{row.regional_frame}</option>}{Object.entries(regionalFrameLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></td>
            <td className="w-20 px-1"><input aria-label={`Onda do idioma ${index + 1}`} className={cell} type="number" min={1} max={99} value={row.launch_wave} onChange={(event) => patchRow("languages", row._key, { launch_wave: event.target.value })}/></td>
            <td className="w-16 px-1 text-center"><input aria-label={`Idioma ${index + 1} ativo`} type="checkbox" checked={row.enabled} onChange={(event) => patchRow("languages", row._key, { enabled: event.target.checked })}/></td>
            <td className="w-8 px-1"><button type="button" aria-label={`Remover idioma ${index + 1}`} onClick={() => removeRow("languages", row._key)} className="rounded p-1 text-slate-400 hover:text-rose-300"><Trash2 size={14}/></button></td>
          </tr>)}</tbody>
        </table></div>
      </div>
    </section>
  );
}
