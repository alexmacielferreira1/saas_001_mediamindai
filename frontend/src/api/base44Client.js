import { request } from './httpClient';

const listeners = new Map();
function emit(entity, event) {
  for (const listener of listeners.get(entity) || []) listener(event);
}

function entityClient(entity) {
  const path = `/records/${encodeURIComponent(entity)}`;
  return {
    async list(sort = '-created_date', limit = 100) {
      return (await request(`${path}?sort=${encodeURIComponent(sort)}&limit=${limit}`)).records;
    },
    async filter(filters = {}, sort = '-created_date', limit = 100) {
      return (await request(`${path}/query`, { method: 'POST', body: { filters, sort, limit } })).records;
    },
    get: (id) => request(`${path}/${encodeURIComponent(id)}`),
    async create(data) {
      const record = await request(path, { method: 'POST', body: { data } });
      emit(entity, { type: 'create', data: record });
      return record;
    },
    async bulkCreate(items) {
      const records = (await request(`${path}/bulk`, { method: 'POST', body: { items } })).records;
      for (const record of records) emit(entity, { type: 'create', data: record });
      return records;
    },
    async update(id, data) {
      const record = await request(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: { data } });
      emit(entity, { type: 'update', data: record });
      return record;
    },
    updateMany: (filters, data) => request(`${path}/bulk`, { method: 'PATCH', body: { filters, data } }),
    async delete(id) {
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
