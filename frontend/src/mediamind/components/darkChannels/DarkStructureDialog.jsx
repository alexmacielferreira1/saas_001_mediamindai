import { useEffect, useState } from "react";
import { Download, FileJson, LayoutTemplate, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportDarkStructure, getDarkStructureTemplate, importDarkStructure, listDarkStructureTemplates } from "../../../api/darkChannels";

export const DARK_STRUCTURE_SCHEMA = "mediamind.dark-structure/v1";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const button = "inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50";

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.readAsText(file);
  });
}

/** Valida o conteúdo de um arquivo de estrutura e devolve o pacote ou lança erro em português. */
export function parseStructurePackage(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Arquivo inválido: o conteúdo não é um JSON válido.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.schema !== DARK_STRUCTURE_SCHEMA) {
    throw new Error(`Formato não reconhecido: o arquivo precisa ter "schema": "${DARK_STRUCTURE_SCHEMA}".`);
  }
  return parsed;
}

function downloadJson(value, fileName) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function IdList({ label, ids }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-300">{label}: {ids.length}</p>
      {!!ids.length && <p className="mt-1 max-h-24 overflow-y-auto break-words text-[11px] text-slate-500">{ids.join(", ")}</p>}
    </div>
  );
}

export default function DarkStructureDialog({ open, onOpenChange, structure, structureError, channelsCount, onImported }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setTemplatesError("");
    listDarkStructureTemplates()
      .then((result) => { if (active) setTemplates(Array.isArray(result) ? result : result?.templates || []); })
      .catch((loadError) => { if (active) { setTemplates([]); setTemplatesError(loadError.message || "Não foi possível carregar os modelos."); } });
    return () => { active = false; };
  }, [open]);

  function reset() {
    setPreview(null); setError(""); setNotice(""); setBusy("");
  }

  async function runPreview(pkg, origin) {
    const result = await importDarkStructure(pkg, { dryRun: true });
    setPreview({ pkg, origin, result });
  }

  async function applyTemplate(templateId, templateName) {
    setBusy(`template:${templateId}`); setError(""); setNotice(""); setPreview(null);
    try {
      const pkg = await getDarkStructureTemplate(templateId);
      await runPreview(pkg, `Modelo ${templateName}`);
    } catch (applyError) {
      setError(applyError.message || "Não foi possível carregar o modelo.");
    } finally { setBusy(""); }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    setFileKey((key) => key + 1);
    if (!file) return;
    setBusy("file"); setError(""); setNotice(""); setPreview(null);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("Arquivo muito grande: o limite é 5 MB.");
      const pkg = parseStructurePackage(await readFileText(file));
      await runPreview(pkg, `Arquivo ${file.name}`);
    } catch (fileError) {
      setError(fileError.message || "Não foi possível analisar o arquivo.");
    } finally { setBusy(""); }
  }

  async function confirmImport() {
    setBusy("confirm"); setError(""); setNotice("");
    try {
      const result = await importDarkStructure(preview.pkg, { dryRun: false });
      const channels = result?.channels || {};
      setPreview(null);
      setNotice(`Importação concluída: ${result?.structure?.languages_count ?? 0} idiomas, ${result?.structure?.niches_count ?? 0} nichos; ${(channels.created || []).length} canais criados, ${(channels.updated || []).length} atualizados, ${(channels.unchanged || []).length} sem alteração.`);
      await onImported?.();
    } catch (importError) {
      setError(importError.message || "Não foi possível importar a estrutura.");
    } finally { setBusy(""); }
  }

  async function exportStructure() {
    setBusy("export"); setError(""); setNotice("");
    try {
      const pkg = await exportDarkStructure();
      downloadJson(pkg, "estrutura-canais-dark.json");
      setNotice("Estrutura exportada para o arquivo estrutura-canais-dark.json.");
    } catch (exportError) {
      setError(exportError.message || "Não foi possível exportar a estrutura.");
    } finally { setBusy(""); }
  }

  const previewChannels = preview?.result?.channels || {};
  const previewErrors = preview?.result?.errors || [];
  const isImported = structure?.source === "importado";

  return (
    <Dialog open={open} onOpenChange={(next) => { reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-white">Estrutura de nichos e idiomas</DialogTitle>
          <DialogDescription className="text-slate-400">Use o modelo padrão do sistema ou importe a estrutura própria da sua operação em JSON. Toda importação mostra uma prévia antes de gravar.</DialogDescription>
        </DialogHeader>

        <section aria-label="Estrutura atual" className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
          {structureError ? <p className="text-amber-300">Não foi possível carregar a estrutura atual: {structureError}</p> : <>
            <p className="text-slate-300">Origem: <strong className="text-white">{structure ? isImported ? "Importada" : "Padrão do sistema" : "Carregando…"}</strong>{structure?.name ? <span className="text-slate-500"> · {structure.name}</span> : null}</p>
            <p className="mt-1 text-xs text-slate-400">{(structure?.languages || []).length} idiomas · {(structure?.niches || []).length} nichos · {channelsCount} canais</p>
          </>}
        </section>

        <section aria-label="Modelos de estrutura" className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Modelos prontos</h3>
          {templates === null ? <p className="text-xs text-slate-400">Carregando modelos…</p> : templates.length ? <ul className="grid gap-2 sm:grid-cols-2">{templates.map((template) => <li key={template.id} className="flex flex-col justify-between gap-2 rounded-lg border border-slate-800 p-3"><div><p className="text-sm font-semibold text-white">{template.name}</p>{template.description && <p className="mt-1 text-xs text-slate-400">{template.description}</p>}<p className="mt-1 text-[11px] text-slate-500">{template.languages_count ?? 0} idiomas · {template.niches_count ?? 0} nichos · {template.channels_count ?? 0} canais{template.decisions_count != null ? ` · ${template.decisions_count} decisões` : ""}</p></div><button type="button" aria-label={`Aplicar modelo ${template.name}`} className={button} disabled={!!busy} onClick={() => void applyTemplate(template.id, template.name)}><LayoutTemplate size={15}/>{busy === `template:${template.id}` ? "Carregando modelo…" : "Aplicar modelo"}</button></li>)}</ul> : <p className="text-xs text-amber-300">{templatesError || "Nenhum modelo disponível."}</p>}
        </section>

        <div className="flex flex-wrap gap-2">
          <label className={`${button} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <Upload size={15}/>{busy === "file" ? "Analisando arquivo…" : "Importar arquivo JSON"}
            <input key={fileKey} type="file" accept="application/json,.json" aria-label="Arquivo JSON da estrutura" className="sr-only" disabled={!!busy} onChange={(event) => void importFile(event)}/>
          </label>
          <button type="button" className={button} disabled={!!busy} onClick={() => void exportStructure()}><Download size={15}/>{busy === "export" ? "Exportando…" : "Exportar estrutura"}</button>
        </div>

        {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</p>}

        {preview && <section aria-label="Prévia da importação" className="space-y-3 rounded-lg border border-cyan-900/60 bg-cyan-950/10 p-3">
          <div className="flex items-start gap-2"><FileJson size={16} className="mt-0.5 shrink-0 text-cyan-400"/><div>
            <p className="text-sm font-semibold text-white">Prévia — nada foi gravado ainda</p>
            <p className="text-xs text-slate-400">{preview.origin}{preview.pkg?.name ? ` · ${preview.pkg.name}` : ""} · {preview.result?.structure?.languages_count ?? 0} idiomas · {preview.result?.structure?.niches_count ?? 0} nichos{preview.result?.structure?.decisions_count != null ? ` · ${preview.result.structure.decisions_count} decisões (${preview.result.structure.decisions_pending ?? 0} pendentes)` : ""}</p>
          </div></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <IdList label="Canais a criar" ids={previewChannels.created || []}/>
            <IdList label="Canais a atualizar" ids={previewChannels.updated || []}/>
            <IdList label="Sem alteração" ids={previewChannels.unchanged || []}/>
          </div>
          {!!previewErrors.length && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-2 text-xs text-rose-200"><p className="font-semibold">Corrija estes erros no arquivo antes de importar:</p><ul className="mt-1 list-disc pl-4">{previewErrors.map((item, index) => <li key={index}>{typeof item === "string" ? item : item?.message || JSON.stringify(item)}</li>)}</ul></div>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300" disabled={busy === "confirm"} onClick={() => setPreview(null)}>Descartar prévia</button>
            <button type="button" className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!!busy || !!previewErrors.length} onClick={() => void confirmImport()}>{busy === "confirm" ? "Importando…" : "Confirmar importação"}</button>
          </div>
        </section>}
      </DialogContent>
    </Dialog>
  );
}
