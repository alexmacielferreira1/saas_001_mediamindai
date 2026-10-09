export function isLocalDemoAvailable({ dev, hostname }) {
  return Boolean(dev) && ['localhost', '127.0.0.1'].includes(hostname);
}

export function readLocalDemoSession({
  dev = import.meta.env.DEV,
  hostname = window.location.hostname,
  storage = window.localStorage,
} = {}) {
  if (!isLocalDemoAvailable({ dev, hostname })) return null;
  try {
    return JSON.parse(storage.getItem('mm_demo_session_v1') || 'null');
  } catch {
    return null;
  }
}
