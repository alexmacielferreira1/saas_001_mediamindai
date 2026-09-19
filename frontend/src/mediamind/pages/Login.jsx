import React, { useState, useRef } from 'react';
import { Loader2, Sparkles, Archive, Search, Scissors, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';
import { ROLE_CATALOG } from '../lib/roleCatalog';

// Quadrinhos de acesso rápido por papel. Cada um preenche o e-mail do papel;
// com a senha já digitada, o clique entra direto (auth real exige a senha).
// Pré-requisito: as contas precisam existir na plataforma com esses e-mails.
const ADMIN_TILES = [
  { label: 'Superadmin (eu)', email: 'superadmin@mediamind.ai', accent: true },
  { label: 'Administrador', email: 'admin@mediamind.ai', accent: true },
];
const ROLE_TILES = [
  ...ADMIN_TILES,
  ...ROLE_CATALOG
    .filter((c) => c.id !== 'admin')
    .map((c) => ({ label: c.name, email: `${c.id}@mediamind.ai`, accent: false })),
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  async function doLogin(mail, pass) {
    setError('');
    setLoading(true);
    try {
      await login(mail, pass);
      // Hard redirect para o AuthProvider re-inicializar com o token.
      window.location.href = '/corp?tab=producao';
    } catch (err) {
      setError(err.message || 'Credenciais inválidas. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await doLogin(email, password);
  }

  async function quickLogin(tile) {
    setError('');
    setEmail(tile.email);
    await doLogin(tile.email, password);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Hero */}
      <div className="relative hidden flex-col justify-center gap-6 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#1a3a6355,transparent_55%)]" />
        <div className="relative">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 text-xl font-extrabold text-slate-950">
              MM
            </div>
            <div>
              <strong className="block text-lg font-bold text-slate-100">MediaMind AI</strong>
              <small className="text-sm text-slate-400">Acervo inteligente para mídia e TV</small>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-slate-50">
            O acervo da sua emissora,<br />organizado pela inteligência artificial.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Transcrição, OCR, detecção de objetos e pessoas — tudo indexado automaticamente.
            Encontre qualquer momento em segundos.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {[
              { icon: Search, text: 'Busca semântica em transcrições e metadados' },
              { icon: Archive, text: 'Acervo centralizado com bibliotecas organizadas' },
              { icon: Scissors, text: 'Cortes virais e publicação direta nas redes' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <f.icon size={18} className="text-sky-400" />
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form + acesso rápido */}
      <div className="flex items-center justify-center bg-slate-900 p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Brand mobile */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 font-extrabold text-slate-950">MM</div>
            <strong className="text-base font-bold text-slate-100">MediaMind AI</strong>
          </div>

          <h2 className="text-2xl font-bold text-slate-100">Entrar</h2>
          <p className="mt-1 text-sm text-slate-400">Acesse sua conta para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-300">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-300">Senha</span>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Entrar
            </button>
          </form>

          {/* Acesso rápido por papel */}
          <div className="mt-8">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck size={13} className="text-sky-400" />
              Acesso rápido por papel
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              Clique num papel pra entrar direto (modo demo, sem autenticação).
            </p>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {ROLE_TILES.map((t) => (
                <button
                  key={t.email}
                  type="button"
                  onClick={() => quickLogin(t)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                    t.accent
                      ? 'border-sky-600/50 bg-sky-500/10 hover:bg-sky-500/20'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    t.accent ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {t.accent ? <ShieldCheck size={14} /> : t.label.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-semibold ${t.accent ? 'text-slate-100' : 'text-slate-300'}`}>{t.label}</p>
                    <p className="truncate text-[10px] text-slate-500">{t.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Modo demonstração — clique num papel para entrar. Autenticação real será reativada depois.
          </p>
        </div>
      </div>
    </div>
  );
}