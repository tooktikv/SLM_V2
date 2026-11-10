import { createContext, useContext } from 'react';
import type { Supplier } from './data/suppliers';
import type { CarTarget, Screen } from './types';
import type { Role } from './qsl/types';

type NavigationContextValue = {
  active: Screen;
  section: string;
  role: Role;
  navigate: (screen: Screen, section?: string, focusSupplierId?: string) => void;
  focusSupplierId?: string;
  setSection: (section: string) => void;
  openSupplier: (supplier: Supplier, tab?: string) => void;
  carTarget: CarTarget | null;
  openCar: (target: CarTarget) => void;
  clearCarTarget: () => void;
};

const NavigationContext = createContext<NavigationContextValue>({
  active: 'dashboard',
  section: '',
  role: 'Coordinator',
  navigate: () => undefined,
  setSection: () => undefined,
  openSupplier: () => undefined,
  carTarget: null,
  openCar: () => undefined,
  clearCarTarget: () => undefined,
});

export const NavigationProvider = NavigationContext.Provider;
export const useNavigation = () => useContext(NavigationContext);
