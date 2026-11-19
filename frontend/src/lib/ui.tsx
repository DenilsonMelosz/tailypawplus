import { createContext, useContext, useState, type ReactNode } from "react";

/** Estado de interface compartilhado: painel "Minha conta" (meus pets, alertas, preferencias). */
const Ctx = createContext<{ accountOpen: boolean; setAccountOpen: (v: boolean) => void }>({ accountOpen: false, setAccountOpen: () => {} });
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  return <Ctx.Provider value={{ accountOpen, setAccountOpen }}>{children}</Ctx.Provider>;
}
