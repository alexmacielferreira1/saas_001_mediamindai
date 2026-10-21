import React, { useState } from 'react';
import { LayoutDashboard, Image as ImageIcon } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { MOCK_CEDOC_MIDIAS } from '../../../data';

// Fotógrafo — ensaios e cobertura de eventos; sobe arquivo no Ingest com metadados.
export default function FotografoPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const midias = MOCK_CEDOC_MIDIAS;

  return (
    <RolePageShell roleId="fotografo" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Coberturas recentes" className="min-h-0">
            <div className="space-y-2">
              {midias.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon size={14} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{m.titulo}</p>
                      <p className="text-[11px] text-slate-500">{m.programa} · {m.tamanho_gb} GB</p>
                    </div>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{m.status}</span>
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Enviar arquivo" className="min-h-0">
            <p className="py-6 text-center text-sm text-slate-500">Use a aba Ingest para subir fotos e ensaios com metadados.</p>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}