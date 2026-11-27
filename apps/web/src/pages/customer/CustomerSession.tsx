import { createContext, useContext } from 'react';

export interface CustomerSession {
  displayName: string;
  logout: () => Promise<void>;
}

export const CustomerSessionContext = createContext<CustomerSession | null>(null);

export function useCustomerSession(): CustomerSession {
  const value = useContext(CustomerSessionContext);
  if (!value) throw new Error('顾客会话尚未初始化');
  return value;
}
