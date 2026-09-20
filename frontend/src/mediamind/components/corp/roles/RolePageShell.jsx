import React from 'react';
import { SubTabsBar } from './RoleShared';
import { COMMON_SUBTABS, CommonScreen, COMMON_IDS } from './CommonScreens';
import RoleInicio from '../RoleInicio';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';

// Casca padrão pras funções: Visão geral (Início padrão da função, via roleId)
// seguida das 4 telas comuns. `ownSubtabs` traz subguias extras da função;
// `children` é o conteúdo quando a subguia ativa não é comum nem a visão geral.
export default function RolePageShell({ ownSubtabs, active, onChange, children, roleId }) {
  const tabs = filterActiveSubtabs(roleId, [...ownSubtabs, ...COMMON_SUBTABS]);
  const safeActive = tabs.some((t) => t.id === active) ? active : (tabs[0]?.id ?? active);
  const isCommon = COMMON_IDS.includes(safeActive);
  const isOverview = safeActive === 'overview';

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={safeActive} onChange={onChange} />
      <div className="h-[calc(100vh-16rem)]">
        {isCommon ? <CommonScreen active={safeActive} /> : isOverview && roleId ? <RoleInicio roleId={roleId} onNavigate={onChange} /> : children}
      </div>
    </div>
  );
}
