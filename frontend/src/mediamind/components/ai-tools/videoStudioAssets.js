// IndexedDB stores binary assets outside JSON drafts. Browser-local, not server-synced.
const DB = 'mediamind-video-studio-assets';
const STORE = 'assets';
function databaseName(scope = 'default') {
  if (!scope || scope === 'default') return DB;
  const suffix = String(scope).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return `${DB}-${suffix}`;
}
function openDb(scope) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(databaseName(scope), 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transaction(mode, operation, scope) {
  const db = await openDb(scope);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = operation(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function putVideoAsset(file, projectId, scope) {
  if (!/^(image|video|audio)\//.test(file.type)) throw new Error('Formato não suportado.');
  const record = { id: crypto.randomUUID(), projectId, name: file.name, type: file.type, size: file.size, createdAt: new Date().toISOString(), blob: file };
  await transaction('readwrite', (store) => store.put(record), scope);
  return { id: record.id, projectId, name: record.name, type: record.type, size: record.size };
}
export async function getVideoAsset(id, scope) { return transaction('readonly', (store) => store.get(id), scope); }
export async function deleteVideoAsset(id, scope) { return transaction('readwrite', (store) => store.delete(id), scope); }
