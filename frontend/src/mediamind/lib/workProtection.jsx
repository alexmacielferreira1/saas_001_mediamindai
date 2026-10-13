import { useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useEmpresa } from "./empresaContext";
import { GraphicDraftProvider, useGraphicDraftState, useWorkScope } from "./graphicDrafts";
export { useWorkScope, useWorkDraftExists } from "./graphicDrafts";

export const useWorkDraftState = useGraphicDraftState;
export function useWorkStorageKey(key) {
  const scope = useWorkScope();
  const sharedScope = scope.replace(/:\/[^:]*:/, ":");
  return sharedScope ? `${sharedScope}:${key}` : key;
}

export default function WorkProtection({ children, persistentPath }) {
  const { user } = useAuth();
  const { currentEmpresa } = useEmpresa();
  const location = useLocation();
  if (!persistentPath && (location.pathname.startsWith("/configuracoes") || location.pathname.includes("administration") || location.pathname === "/management" || location.pathname === "/ferramentas-graficas")) return children;
  const params = new URLSearchParams(location.search);
  const project = params.get("project_id") || params.get("project") || "";
  const scope = `work:${currentEmpresa?.id || "global"}:${user?.id || "anonymous"}:${persistentPath || location.pathname}:${persistentPath ? '' : project}`;
  return <GraphicDraftProvider key={scope} scope={scope}>{children}</GraphicDraftProvider>;
}
