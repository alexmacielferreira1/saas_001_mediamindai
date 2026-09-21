import React from 'react';
import { Search, Upload, LayoutDashboard, FileText } from 'lucide-react';
import SearchPage from '../../../pages/Search';
import Ingest from '../../../pages/Ingest';
import Workspace from '../../../pages/Workspace';
import Timeline from '../../../pages/Timeline';

// As 4 telas comuns que toda função recebe — Pesquisa, Ingest, Workspace e
// Modo Roteiro. Reaproveita as pages já existentes em vez de duplicar.
export const COMMON_SUBTABS = [
  { id: 'pesquisa', name: 'Pesquisa', Icon: Search },
  { id: 'ingest', name: 'Ingest', Icon: Upload },
  { id: 'workspace', name: 'Workspace', Icon: LayoutDashboard },
  { id: 'roteiro', name: 'Modo Roteiro', Icon: FileText },
];

export const COMMON_IDS = COMMON_SUBTABS.map((t) => t.id);

export function CommonScreen({ active }) {
  if (active === 'pesquisa') return <div className="h-full overflow-y-auto"><SearchPage /></div>;
  if (active === 'ingest') return <div className="h-full overflow-y-auto"><Ingest /></div>;
  if (active === 'workspace') return <div className="h-full overflow-y-auto"><Workspace /></div>;
  if (active === 'roteiro') return <div className="h-full overflow-hidden"><Timeline embedded /></div>;
  return null;
}
