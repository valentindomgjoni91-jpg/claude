import { createContext, useContext, useState, type ReactNode } from 'react';
import { db } from '../db';

interface AdminContextValue {
  isAdmin: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  unlock: async () => false,
  lock: () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() =>
    sessionStorage.getItem('isAdmin') === '1'
  );

  const unlock = async (pin: string): Promise<boolean> => {
    const company = await db.company.toCollection().first();
    const stored = company?.adminPin ?? '';
    if (pin === stored) {
      sessionStorage.setItem('isAdmin', '1');
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const lock = () => {
    sessionStorage.removeItem('isAdmin');
    setIsAdmin(false);
  };

  return (
    <AdminContext.Provider value={{ isAdmin, unlock, lock }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
