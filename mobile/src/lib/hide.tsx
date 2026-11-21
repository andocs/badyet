import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import 'expo-sqlite/localStorage/install';

const KEY = 'hide';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

type Ctx = { hide: boolean; toggle: () => void };
const HideCtx = createContext<Ctx>({ hide: false, toggle: () => {} });

/** Hide-amounts mode: every peso figure shows as asterisks. Remembered on the phone. */
export function HideProvider({ children }: { children: ReactNode }) {
  const [hide, setHide] = useState(read);
  const toggle = useCallback(() => {
    setHide((h) => {
      try {
        localStorage.setItem(KEY, h ? '0' : '1');
      } catch {}
      return !h;
    });
  }, []);
  return <HideCtx.Provider value={{ hide, toggle }}>{children}</HideCtx.Provider>;
}

export const useHide = () => useContext(HideCtx);
