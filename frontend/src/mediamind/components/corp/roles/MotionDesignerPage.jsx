import React, { useState } from 'react';
import { LayoutDashboard, Film } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { MOCK_CORP_EDITS, MOCK_CORP_EDIT_APPROVALS } from '../../../data';

const TONE = {
  'Em edição': 'bg-sky-500/15 text-sky-300',
  Revisão: 'bg-amber-500/15 text-amber-300',
  'Na fila': 'bg-slate-500/15 text-slate-300',
};

// Motion Designer / Animador — vinheta de abertura, motion graphics e intros
// (separado do Designer estático e do Editor de vídeo).
export default function MotionDesignerPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const edits = MOCK_CORP_EDITS;
  const approvals = MOCK_CORP_EDIT_APPROVALS;

  return (
    <RolePageShell roleId="motion_designer" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Motion graphics & vinheta" className="min-h-0">
            <div className="space-y-2">
              {edits.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Film size={14} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{e.titulo}</p>
                      <p className="text-[11px] text-slate-500">{e.programa} · prazo {e.prazo} · {e.progresso}%</p>
                    </div>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${TONE[e.status] || 'bg-slate-800 text-slate-300'}`}>{e.status}</span>
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Aprovações" className="min-h-0">
            <div className="space-y-2">
              {approvals.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{a.titulo}</p>
                    <p className="text-[11px] text-slate-500">{a.solicitante} · {a.tempo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}