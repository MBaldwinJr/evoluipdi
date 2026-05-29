import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Org = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  status: string;
  timezone: string;
  block_outside_geofence: boolean;
  roles: string[];
};

type Ctx = {
  orgs: Org[];
  current: Org | null;
  setCurrent: (id: string) => void;
  entitlements: { plan_code: string; modules: string[] };
  isAdmin: boolean;
  isRH: boolean;
  hasModule: (m: string) => boolean;
};

const OrgCtx = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "active_org_id";

export function OrgProvider({
  orgs,
  entitlements,
  children,
}: {
  orgs: Org[];
  entitlements: { plan_code: string; modules: string[] };
  children: ReactNode;
}) {
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if ((!currentId || !orgs.find((o) => o.id === currentId)) && orgs[0]) {
      setCurrentId(orgs[0].id);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, orgs[0].id);
    }
  }, [orgs, currentId]);

  const current = orgs.find((o) => o.id === currentId) ?? orgs[0] ?? null;
  const roles = current?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isRH = isAdmin || roles.includes("rh");

  const setCurrent = (id: string) => {
    setCurrentId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      // reload to refetch entitlements
      window.location.reload();
    }
  };

  const hasModule = (m: string) => entitlements.modules.includes(m);

  return (
    <OrgCtx.Provider value={{ orgs, current, setCurrent, entitlements, isAdmin, isRH, hasModule }}>
      {children}
    </OrgCtx.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgCtx);
  if (!ctx) throw new Error("useOrg must be inside OrgProvider");
  return ctx;
}
