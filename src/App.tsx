import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { MenuIcon } from './components/icons';
import { useLang } from './i18n';
import { CarTarget, Screen } from './types';
import type { Role } from './qsl/types';
import { modules, resolveSection, sectionsOf } from './modules';
import Dashboard from './screens/dashboard/DashboardOverview';
import SupplierManagement from './screens/SupplierManagement';
import Supplier360 from './screens/Supplier360';
import Onboarding from './screens/Onboarding';
import Tasks from './screens/Tasks';
import Qualification from './screens/Qualification';
import Qsl from './screens/Qsl';
import RiskManagement from './screens/RiskManagement';
import Performance from './screens/Performance';
import Audit from './screens/Audit';
import CAR from './screens/CAR';
import Compliance from './screens/Compliance';
import Relationship from './screens/Relationship';
import Analytics from './screens/Analytics';
import Administration from './screens/Administration';
import { Supplier, suppliers } from './data/suppliers';
import { NavigationProvider } from './NavigationContext';

const knownScreens = new Set<string>([...modules.map(item => item.id), 'supplier360']);

function initialScreen(): Screen {
  const requested = new URLSearchParams(window.location.search).get('screen');
  return requested && knownScreens.has(requested) ? (requested as Screen) : 'dashboard';
}

export default function App() {
  useLang();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [sections, setSections] = useState<Record<string, string>>(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    return requested ? { [initialScreen()]: requested } : {};
  });
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier>(suppliers[0]);
  const [supplierTab, setSupplierTab] = useState<string | undefined>();
  const [focusSupplierId, setFocusSupplierId] = useState<string | undefined>();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [carTarget, setCarTarget] = useState<CarTarget | null>(null);

  // Mockup: the whole system is shown from the Admin view, which holds every permission.
  const role: Role = 'Admin';
  const section = resolveSection(screen, role, sections[screen]);

  const navigate = (next: Screen, requested?: string, focusId?: string) => {
    setScreen(next);
    setFocusSupplierId(focusId);
    if (requested) setSections(current => ({ ...current, [next]: requested }));
    else if (!sectionsOf(next, role).length) setSections(({ [next]: _dropped, ...rest }) => rest);
  };
  const setSection = (requested: string) => setSections(current => ({ ...current, [screen]: requested }));

  const openCar = (target: CarTarget) => {
    setCarTarget(target);
    setScreen('car');
  };

  const openSupplier = (supplier: Supplier, tab?: string) => {
    setSelectedSupplier(supplier);
    setSupplierTab(tab);
    setScreen('supplier360');
  };

  function renderScreen() {
    switch (screen) {
      case 'dashboard': return <Dashboard />;
      case 'suppliers': return <SupplierManagement key={section} onOpenSupplier={openSupplier} />;
      case 'supplier360': return <Supplier360 key={`${selectedSupplier.id}-${supplierTab ?? ''}`} supplier={selectedSupplier} initialTab={supplierTab} onBack={() => setScreen('suppliers')} />;
      case 'onboarding': return <Onboarding key={section} />;
      case 'tasks': return <Tasks />;
      case 'qualification': return <Qualification key={section} />;
      case 'qsl': return <Qsl key={section} />;
      case 'risk': return <RiskManagement />;
      case 'performance': return <Performance />;
      case 'audit': return <Audit />;
      case 'car': return <CAR key={focusSupplierId ?? 'all'} />;
      case 'compliance': return <Compliance key={`${section}-${focusSupplierId ?? ''}`} />;
      case 'relationship': return <Relationship key={focusSupplierId ?? 'all'} />;
      case 'analytics': return <Analytics key={section} />;
      case 'administration': return <Administration />;
      default: return <Dashboard />;
    }
  }

  return (
    <NavigationProvider value={{ active: screen, section, role, navigate, focusSupplierId, setSection, openSupplier, carTarget, openCar, clearCarTarget: () => setCarTarget(null) }}>
      <div className="flex h-full overflow-hidden bg-canvas font-sans text-ink-soft">
        <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
          className="fixed left-3 top-3 z-30 hidden h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-ink-soft shadow-card transition-colors hover:bg-sunken max-lg:flex"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {renderScreen()}
        </main>
      </div>
    </NavigationProvider>
  );
}
