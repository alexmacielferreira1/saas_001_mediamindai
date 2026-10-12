import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const DraftContext = createContext(null);
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mediamind-graphic-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read(scope) {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").get(scope);
    request.onsuccess = () => resolve(request.result || {});
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
async function write(scope, value) {
  const db = await database();
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    const store = transaction.objectStore("drafts");
    const previous = store.get(scope);
    previous.onsuccess = () => {
      if (previous.result) store.put(previous.result, `${scope}:previous`);
      store.put(value, scope);
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }); } finally { db.close(); }
}
async function archive(value, media) {
  if (typeof value === "string" && value.startsWith("blob:")) {
    if (!media.has(value)) media.set(value, fetch(value).then(response => {
      if (!response.ok) throw new Error("Mídia indisponível");
      return response.blob();
    }));
    return { __graphicMedia: true, blob: await media.get(value) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(item => archive(item, media)));
  if (value && typeof value === "object") {
    if (value instanceof Blob) return value;
    return Object.fromEntries(await Promise.all(Object.entries(value).filter(([key]) => !/^(password|senha|api[_-]?key|access[_-]?token|refresh[_-]?token|encrypted[_-]?key|secret)$/i.test(key)).map(async ([key, item]) => [key, await archive(item, media)])));
  }
  return value;
}
function restore(value, urls) {
  if (value?.__graphicMedia && value.blob instanceof Blob) {
    const url = URL.createObjectURL(value.blob); urls.push(url); return url;
  }
  if (Array.isArray(value)) return value.map(item => restore(item, urls));
  if (value && typeof value === "object" && !(value instanceof Blob)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restore(item, urls)]));
  return value;
}

async function portable(value) {
  if (value instanceof Blob) return { __graphicFile: true, type: value.type, ...(value instanceof File ? { name: value.name, lastModified: value.lastModified } : {}), data: await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(value);
  }) };
  if (Array.isArray(value)) return Promise.all(value.map(portable));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await portable(item)])));
  return value;
}
async function unpack(value) {
  if (value?.__graphicFile) {
    if (typeof value.data !== "string" || !value.data.startsWith("data:")) throw new Error("Arquivo inválido");
    const blob = await (await fetch(value.data)).blob();
    return value.name ? new File([blob], value.name, { type: value.type, lastModified: value.lastModified }) : blob;
  }
  if (Array.isArray(value)) return Promise.all(value.map(unpack));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await unpack(item)])));
  return value;
}

export function GraphicDraftProvider({ scope, children }) {
  const values = useRef({});
  const media = useRef(new Map());
  const queue = useRef(Promise.resolve());
  const timer = useRef(null);
  const maxWait = useRef(null);
  const alive = useRef(true);
  const loaded = useRef(false);
  const revision = useRef(0);
  const dirty = useRef(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Carregando rascunhos…");
  const [version, setVersion] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const flush = useRef(null);
  flush.current = () => {
    clearTimeout(timer.current);
    clearTimeout(maxWait.current); maxWait.current = null;
    if (!loaded.current) return;
    const snapshot = { ...values.current };
    const savedRevision = revision.current;
    // Capture temporary media before editor cleanup revokes object URLs.
    const encoded = archive(snapshot, media.current).then(value => ({ value }), error => ({ error }));
    queue.current = queue.current.catch(() => {}).then(async () => {
      const result = await encoded;
      if (result.error) throw result.error;
      await write(scope, result.value);
      if (savedRevision === revision.current) {
        dirty.current = false;
        if (alive.current) setStatus("Rascunho salvo neste navegador");
      }
    }).catch(() => { if (alive.current) setStatus("Falha ao salvar rascunho. Mantenha a página aberta e salve/exporte o projeto."); });
  };
  useEffect(() => {
    alive.current = true;
    let active = true;
    read(scope).then(value => {
      if (!active) return;
      values.current = restore(value, []);
      loaded.current = true;
      setReady(true); setStatus("Rascunhos recuperados neste navegador");
    }).catch(() => { if (active) { setReady(true); setStatus("Armazenamento local indisponível. Baixe a recuperação antes de sair."); } });
    const visibility = () => { if (document.visibilityState === "hidden") flush.current(); };
    const beforeUnload = event => {
      if (!dirty.current) return;
      flush.current(); event.preventDefault(); event.returnValue = "";
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", beforeUnload);
    return () => { flush.current(); active = false; alive.current = false; document.removeEventListener("visibilitychange", visibility); window.removeEventListener("beforeunload", beforeUnload); };
  }, [scope]);
  const context = {
    scope,
    read: key => values.current[key],
    update: (key, value) => {
      if (values.current[key] === value) return;
      values.current[key] = value;
      revision.current += 1; dirty.current = true;
      if (!loaded.current) { setStatus("Armazenamento local indisponível. Baixe a recuperação antes de sair."); return; }
      setStatus("Salvando rascunho…");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush.current(), 400);
      if (!maxWait.current) maxWait.current = setTimeout(() => flush.current(), 5000);
    },
  };
  async function download() {
    try {
      const content = await portable(await archive(values.current, media.current));
      const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: "mm-graphic-recovery/v1", scope, content })], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "mediamind-rascunhos-recuperacao.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus("Arquivo de recuperação gerado");
    } catch { setStatus("Falha ao gerar recuperação. Mantenha a página aberta."); }
  }
  async function recover(file) {
    setRecovering(true); clearTimeout(timer.current);
    try {
      await queue.current;
      let content;
      if (file) {
        const parsed = JSON.parse(await file.text());
        if (parsed.scope && parsed.scope !== scope) throw new Error("A recuperação pertence a outra empresa, usuário ou área.");
        if (parsed.schema !== "mm-graphic-recovery/v1" || !parsed.content || Array.isArray(parsed.content) || typeof parsed.content !== "object") throw new Error("Arquivo inválido");
        content = await unpack(parsed.content);
      } else {
        content = await read(`${scope}:previous`);
        if (!Object.keys(content).length) throw new Error("Nenhuma cópia anterior");
      }
      await write(scope, content);
      values.current = restore(content, []);
      dirty.current = false;
      media.current.clear(); setVersion(old => old + 1);
      setStatus("Projeto restaurado da cópia de recuperação");
    } catch { setStatus("Não foi possível restaurar. O trabalho atual foi preservado."); }
    finally { setRecovering(false); }
  }
  return <DraftContext.Provider value={context}><div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-400"><p role="status">{status}</p>{ready && <><button type="button" disabled={recovering} onClick={download}>Baixar recuperação</button><button type="button" disabled={recovering} onClick={() => { if (window.confirm("Restaurar a cópia anterior? O rascunho atual será guardado como cópia anterior.")) recover(); }}>Restaurar cópia anterior</button><label className="cursor-pointer">Abrir recuperação<input className="sr-only" aria-label="Abrir arquivo de recuperação" type="file" accept="application/json,.json" disabled={recovering} onChange={event => { const file = event.target.files[0]; if (file && window.confirm("Restaurar os trabalhos deste arquivo? O rascunho atual será guardado como cópia anterior.")) recover(file); event.target.value = ""; }} /></label></>}</div>{ready && <div key={version}>{children}</div>}</DraftContext.Provider>;
}

export function useGraphicDraftState(key, initial) {
  const context = useContext(DraftContext);
  const initialValue = () => {
    const saved = context?.read(key);
    return saved !== undefined ? saved : typeof initial === "function" ? initial() : initial;
  };
  const [entry, setEntry] = useState(() => ({ key, value: initialValue() }));
  let value = entry.value;
  if (entry.key !== key) { value = initialValue(); setEntry({ key, value }); }
  const setValue = useCallback(change => setEntry(current => ({ key, value: typeof change === "function" ? change(current.value) : change })), [key]);
  useEffect(() => { context?.update(key, value); }, [key, value, context]);
  return [value, setValue];
}

export function useWorkScope() { return useContext(DraftContext)?.scope || ""; }
export function useWorkDraftExists(key) { return useContext(DraftContext)?.read(key) !== undefined; }
