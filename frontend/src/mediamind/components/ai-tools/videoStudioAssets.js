// IndexedDB stores binary assets outside JSON drafts. Browser-local, not server-synced.
const DB = 'mediamind-video-studio-assets';
const STORE = 'assets';
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transaction(mode, operation) {
  const db = await openDb();
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
export async function putVideoAsset(file, projectId) {
  if (!/^(image|video|audio)\//.test(file.type)) throw new Error('Formato não suportado.');
  const record = { id: crypto.randomUUID(), projectId, name: file.name, type: file.type, size: file.size, createdAt: new Date().toISOString(), blob: file };
  await transaction('readwrite', (store) => store.put(record));
  return { id: record.id, projectId, name: record.name, type: record.type, size: record.size };
}
export async function getVideoAsset(id) { return transaction('readonly', (store) => store.get(id)); }
export async function deleteVideoAsset(id) { return transaction('readwrite', (store) => store.delete(id)); }
