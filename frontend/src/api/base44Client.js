import { request } from './httpClient';
import { readLocalDemoSession } from '../mediamind/lib/demoAccess';

const listeners = new Map();
const demoEntities = new Map();
const DEMO_ENTITY_STORAGE_PREFIX = 'mediamind_demo_entities_v1';

function demoEntityKey(entity) {
  const session = readLocalDemoSession();
  const scope = session?.id || session?.email || 'local';
  return `${DEMO_ENTITY_STORAGE_PREFIX}:${scope}:${entity}`;
}

function readDemoEntities(entity) {
  const key = demoEntityKey(entity);
  if (demoEntities.has(key)) return demoEntities.get(key);
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(key) || '[]');
    const records = Array.isArray(stored) ? stored : [];
    demoEntities.set(key, records);
    return records;
  } catch {
    demoEntities.set(key, []);
    return [];
  }
}

function writeDemoEntities(entity, records) {
  const key = demoEntityKey(entity);
  demoEntities.set(key, records);
  try { globalThis.localStorage?.setItem(key, JSON.stringify(records)); } catch { /* memória continua disponível */ }
}

function emit(entity, event) {
  for (const listener of listeners.get(entity) || []) listener(event);
}

function entityClient(entity) {
  const path = `/records/${encodeURIComponent(entity)}`;
  const demoList = () => readDemoEntities(entity);
  const saveDemoList = (records) => writeDemoEntities(entity, records);
  return {
    async list(sort = '-created_date', limit = 100) {
      if (readLocalDemoSession()) return demoList().slice(0, limit);
      return (await request(`${path}?sort=${encodeURIComponent(sort)}&limit=${limit}`)).records;
    },
    async filter(filters = {}, sort = '-created_date', limit = 100) {
      if (readLocalDemoSession()) return demoList().slice(0, limit);
      return (await request(`${path}/query`, { method: 'POST', body: { filters, sort, limit } })).records;
    },
    get: (id) => readLocalDemoSession()
      ? Promise.resolve(demoList().find((record) => String(record.id) === String(id)) || null)
      : request(`${path}/${encodeURIComponent(id)}`),
    async create(data) {
      if (readLocalDemoSession()) {
        const record = { ...data, id: `demo-${entity}-${crypto.randomUUID()}` };
        saveDemoList([...demoList(), record]);
        emit(entity, { type: 'create', data: record });
        return record;
      }
      const record = await request(path, { method: 'POST', body: { data } });
      emit(entity, { type: 'create', data: record });
      return record;
    },
    async bulkCreate(items) {
      if (readLocalDemoSession()) {
        const records = items.map((data) => ({ ...data, id: `demo-${entity}-${crypto.randomUUID()}` }));
        saveDemoList([...demoList(), ...records]);
        for (const record of records) emit(entity, { type: 'create', data: record });
        return records;
      }
      const records = (await request(`${path}/bulk`, { method: 'POST', body: { items } })).records;
      for (const record of records) emit(entity, { type: 'create', data: record });
      return records;
    },
    async update(id, data) {
      if (readLocalDemoSession()) {
        const current = demoList().find((record) => String(record.id) === String(id)) || { id };
        const record = { ...current, ...data, id: current.id };
        saveDemoList(demoList().some((item) => String(item.id) === String(id))
          ? demoList().map((item) => (String(item.id) === String(id) ? record : item))
          : [...demoList(), record]);
        emit(entity, { type: 'update', data: record });
        return record;
      }
      const record = await request(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: { data } });
      emit(entity, { type: 'update', data: record });
      return record;
    },
    updateMany: (filters, data) => readLocalDemoSession()
      ? Promise.resolve([])
      : request(`${path}/bulk`, { method: 'PATCH', body: { filters, data } }),
    async delete(id) {
      if (readLocalDemoSession()) {
        saveDemoList(demoList().filter((record) => String(record.id) !== String(id)));
        emit(entity, { type: 'delete', id });
        return;
      }
      await request(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      emit(entity, { type: 'delete', id });
    },
    subscribe(listener) {
      const current = listeners.get(entity) || new Set();
      current.add(listener);
      listeners.set(entity, current);
      return () => current.delete(listener);
    },
  };
}

/** @returns {Promise<any>} */
function unavailable(message) {
  return Promise.reject(new Error(message));
}

export const base44 = {
  entities: new Proxy({}, { get: (_target, entity) => entityClient(String(entity)) }),
  functions: {
    invoke: (functionName, body = {}) => readLocalDemoSession()
      ? unavailable('IA ainda não configurada no modo demo.')
      : request(
        `/ai/functions/${encodeURIComponent(functionName)}`,
        { method: 'POST', body },
      ),
  },
  integrations: { Core: { UploadPublicFile({ file }) {
    const body = new FormData();
    body.append('file', file);
    return request('/uploads', { method: 'POST', body });
  } } },
  auth: {
    loginViaEmailPassword: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: async () => (await request('/auth/session')).user,
    isAuthenticated: async () => { try { await request('/auth/session'); return true; } catch { return false; } },
    logout: async (returnTo) => { await request('/auth/logout', { method: 'POST' }); if (returnTo) window.location.href = '/'; },
    redirectToLogin: () => { window.location.href = '/'; },
    loginWithProvider: (_provider, _returnTo) => { throw new Error('Login Google será habilitado na fase de produção.'); },
    register: (..._args) => unavailable('Cadastro público não está disponível no modo demo.'),
    resendOtp: (..._args) => unavailable('OTP não está disponível no modo demo.'),
    setToken: (..._args) => {},
    verifyOtp: (..._args) => unavailable('OTP não está disponível no modo demo.'),
    resetPasswordRequest: (..._args) => unavailable('Recuperação será habilitada na fase de clientes reais.'),
    resetPassword: (..._args) => unavailable('Recuperação será habilitada na fase de clientes reais.'),
  },
  app: { getPublicSettings: async () => ({ id: 'mediamind-local', public_settings: {} }) },
};
