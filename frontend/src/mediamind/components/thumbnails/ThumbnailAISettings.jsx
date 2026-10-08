import React, { useEffect, useState } from 'react';
import { request } from '@/api/httpClient';
const control = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs';
export default function ThumbnailAISettings() {
  const [settings, setSettings] = useState(null); const [key, setKey] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { request('/thumbnail-settings').then(setSettings).catch((e) => setMessage(e.message)); }, []);
  async function action(test = false) {
    setBusy(true); setMessage('');
    try {
      if (test) { const result = await request('/thumbnail-settings/test', { method: 'POST' }); setMessage(result.message); }
      else { const saved = await request('/thumbnail-settings', { method: 'PATCH', body: { provider: settings.provider, model: settings.model, monthly_limit: settings.monthly_limit, ...(key ? { api_key: key } : {}), clear_key: settings.clear_key || false } }); setSettings(saved); setKey(''); setMessage('Configuração salva no servidor.'); }
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="mm-panel"><details><summary className="cursor-pointer font-bold">IA para recorte de fotos</summary><div className="mt-3 space-y-3 text-xs">
    {settings && <><p>{settings.provider === 'local' ? 'Processamento no servidor, sem créditos externos.' : 'Fotos são enviadas ao remove.bg. Cada novo recorte pode consumir créditos.'}</p>
      <label className="block">Provedor<select aria-label="Provedor de recorte" disabled={!settings.can_manage} className={control} value={settings.provider} onChange={(e) => setSettings({ ...settings, provider: e.target.value })}><option value="local">Local — rembg</option><option value="removebg">remove.bg — chave API</option></select></label>
      {settings.provider === 'local' && <label className="block">Modelo<select aria-label="Modelo de recorte" disabled={!settings.can_manage} className={control} value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}><option value="isnet-general-use">IS-Net</option><option value="u2netp">U2Net pequeno</option></select></label>}
      {settings.can_manage && <><label className="block">Chave API {settings.key_configured ? '(configurada)' : ''}<input aria-label="Chave API de recorte" type="password" autoComplete="new-password" value={key} className={control} onChange={(e) => setKey(e.target.value)} placeholder="Não exibida após salvar" /></label><label className="block"><input type="checkbox" checked={settings.clear_key || false} onChange={(e) => setSettings({ ...settings, clear_key: e.target.checked })} /> Revogar chave salva</label><label className="block">Limite mensal de chamadas externas<input aria-label="Limite de recortes externos" type="number" min={0} max={100000} value={settings.monthly_limit} className={control} onChange={(e) => setSettings({ ...settings, monthly_limit: Number(e.target.value) })} /></label><div className="flex gap-2"><button type="button" className="w2-button" disabled={busy} onClick={() => action()}>Salvar configuração</button><button type="button" className="w2-button" disabled={busy} onClick={() => action(true)}>Testar configuração salva</button></div></>}
      <p>Chamadas externas tentadas no mês: {settings.external_attempts_this_month}. Saldo de créditos não consultado.</p>
      {!settings.can_manage && <p>Somente administradores com permissão podem alterar esta configuração.</p>}
    </>}
    {message && <p role="status" className="text-amber-200">{message}</p>}
  </div></details></section>;
}
