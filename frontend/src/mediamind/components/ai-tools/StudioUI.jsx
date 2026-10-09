import { Download, Sparkles } from "lucide-react";
export const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-400";
export function Field({ label, children, hint }) {
  return (
    <label className="block space-y-2 text-xs font-semibold text-slate-400">
      <span>{label}</span>
      {children}
      {hint && <span className="block font-normal text-slate-500">{hint}</span>}
    </label>
  );
}
export function Panel({ title, children, number }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        {number && (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 text-xs text-sky-300">
            {number}
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}
export function Button({
  children,
  onClick,
  disabled = false,
  primary = false,
  ...props
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "bg-sky-400 text-slate-950 hover:bg-sky-300" : "border border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500"}`}
    >
      {children}
    </button>
  );
}
export function StudioHeader({ title, description, children }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-300">
          <Sparkles size={14} />
          MediaMind · Creative Studio
        </div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  );
}
export function Notice({ children }) {
  return children ? (
    <p
      role="status"
      className="rounded-xl border border-sky-500/25 bg-sky-950/40 px-4 py-3 text-sm text-sky-200"
    >
      {children}
    </p>
  ) : null;
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function downloadJson(value, name) {
  downloadBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    name,
  );
}
export function ExportDraft({ value, name = "storyboard.json" }) {
  return (
    <Button onClick={() => downloadJson(value, name)}>
      <Download size={15} />
      Baixar projeto
    </Button>
  );
}
export function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith("image/"))
      return reject(new Error("Escolha uma imagem JPG, PNG ou WebP."));
    if (file.size > 15 * 1024 * 1024)
      return reject(new Error("Use uma imagem de até 15 MB."));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(file);
  });
}
