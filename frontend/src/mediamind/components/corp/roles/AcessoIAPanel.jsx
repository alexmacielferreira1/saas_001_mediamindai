import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2, Check } from 'lucide-react';
import { suggestAccess } from '../../../../api/aiTools';
import { ROLE_CATALOG, setUserAccess } from '../../../lib/roleCatalog';
import { CORP_SCREENS, SCREEN_NAME } from '../../../lib/corpTabs';
import { MOCK_USERS } from '../../../data';
import AudioPromptInput from './AudioPromptInput';

// Painel "Configurar acesso por IA": prompt de texto e/ou áudio → IA monta o
// cargo + telas (extraTabs/removedTabs). Mostra prévia; o admin aplica.
export default function AcessoIAPanel() {
  const [userId, setUserId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(false);

  const target = MOCK_USERS.find((u) => String(u.id) === userId);

  async function gerar() {
    setError('');
    setPreview(null);
    setApplied(false);
    if (!userId) { setError('Selecione um funcionário.'); return; }
    if (!prompt && !audioUrl) { setError('Escreva um prompt ou grave/envie um áudio.'); return; }
    setLoading(true);
    try {
      const data = await suggestAccess({
        userName: target?.name || '',
        prompt,
        audioUrl,
        screens: CORP_SCREENS,
        cargos: ROLE_CATALOG.map((c) => ({ id: c.id, name: c.name })),
      });
      const screenIds = new Set(CORP_SCREENS.map((s) => s.id));
      const cargoIds = new Set(ROLE_CATALOG.map((c) => c.id));
      const role = cargoIds.has(data.role) ? data.role : '';
      const extraTabs = (data.extraTabs || []).filter((t) => screenIds.has(t));
      const removedTabs = (data.removedTabs || []).filter((t) => screenIds.has(t));
      setPreview({ role, extraTabs, removedTabs, transcription: data.transcription || '' });
    } catch (e) {
      setError('Falha na IA: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function aplicar() {
    if (!preview || !preview.role) { setError('A IA não retornou um cargo válido.'); return; }
    setUserAccess(String(userId), { role: preview.role, extraTabs: preview.extraTabs, removedTabs: preview.removedTabs });
    setApplied(true);
    setPreview(null);
    setPrompt('');
    setAudioUrl('');
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={15} className="text-violet-400" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Configurar acesso por IA</h3>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">Descreva em linguagem natural o acesso desejado (por texto ou áudio) e a IA monta o cargo + telas. Revise antes de aplicar.</p>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-slate-400">Funcionário:</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
            <option value="">Selecione…</option>
            {MOCK_USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ex.: A Marina é a nova videomaker; deve ver Produção e Gravações, mas não Design nem Revistas."
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
        />

        <AudioPromptInput onAudioUrl={setAudioUrl} />

        {error && <p className="text-[11px] text-rose-400">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={gerar} disabled={loading} className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Gerar configuração
          </button>
        </div>

        {preview && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Prévia gerada pela IA</p>
            {preview.transcription && <p className="mb-2 text-[11px] text-slate-500">Áudio transcrito: “{preview.transcription}”</p>}
            <div className="mb-2 text-xs text-slate-200">
              Cargo: <span className="font-bold text-sky-300">{ROLE_CATALOG.find((c) => c.id === preview.role)?.name || preview.role}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.extraTabs.map((t) => <span key={t} className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">+ {SCREEN_NAME[t] || t}</span>)}
              {preview.removedTabs.map((t) => <span key={t} className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">− {SCREEN_NAME[t] || t}</span>)}
              {!preview.extraTabs.length && !preview.removedTabs.length && <span className="text-[11px] text-slate-500">Padrão do cargo, sem ajustes.</span>}
            </div>
            <button onClick={aplicar} className="mt-3 flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400">
              <Check size={13} /> Aplicar ao funcionário
            </button>
          </div>
        )}
        {applied && <p className="text-[11px] text-emerald-300">Configuração aplicada ao funcionário.</p>}
      </div>
    </section>
  );
}