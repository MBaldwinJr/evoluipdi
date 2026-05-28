import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Company = { id: string; legal_name: string; trade_name?: string | null; role: string; block_outside_geofence?: boolean };

type Ctx = {
  companies: Company[];
  current: Company | null;
  setCurrent: (id: string) => void;
  setCompanies: (cs: Company[]) => void;
};

const PtCtx = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = "pt_active_company";

export function PtCompanyProvider({ children, initialCompanies }: { children: ReactNode; initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (!currentId && companies[0]) setCurrentId(companies[0].id);
  }, [companies, currentId]);

  const current = companies.find((c) => c.id === currentId) ?? companies[0] ?? null;

  const setCurrent = (id: string) => {
    setCurrentId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <PtCtx.Provider value={{ companies, current, setCurrent, setCompanies }}>{children}</PtCtx.Provider>
  );
}

export function usePtCompany() {
  const ctx = useContext(PtCtx);
  if (!ctx) throw new Error("usePtCompany must be inside PtCompanyProvider");
  return ctx;
}

export function hasRole(role: string | undefined, allowed: string[]) {
  return !!role && allowed.includes(role);
}
