import Header from '../components/Header';
import { suppliers as supplierDirectory } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { demoActors } from '../qsl/actors';
import { sectionLabel } from '../modules';
import { Callout, Page, PageBody, PageScroll } from '../components/ui';
import { EligibilityTab } from './qsl/Eligibility';
import { MonitoringTab } from './qsl/Monitoring';
import { OverviewTab } from './qsl/Overview';
import { PublishingTab } from './qsl/Publishing';
import { ReportsTab } from './qsl/Reports';

// Module 5: QSL Management (Qualified Supplier List). It builds on the approved results of module 4.
export default function Qsl() {
  const { role, section, setSection, navigate, openSupplier } = useNavigation();
  const actor = demoActors.Admin;
  const title = sectionLabel('qsl', role, section) ?? 'QSL Management';
  const openProfile = (supplierId: string) => {
    const supplier = supplierDirectory.find(item => item.id === supplierId);
    if (supplier) openSupplier(supplier);
  };

  const body = () => {
    switch (section) {
      case 'eligibility': return <EligibilityTab actor={actor} onGo={setSection} />;
      case 'publishing': return <PublishingTab actor={actor} />;
      case 'monitoring': return <MonitoringTab actor={actor} onRequalify={() => navigate('qualification', 'requalification')} />;
      case 'reports': return <ReportsTab actor={actor} />;
      case 'overview': return <OverviewTab actor={actor} onGo={setSection} onProfile={openProfile} />;
      default: return <Callout tone="warning" title="QSL Management is not available for this role" />;
    }
  };

  return (
    <Page>
      <Header breadcrumb={['Supplier lifecycle', 'QSL Management']} title={title} />
      <PageScroll>
        <PageBody>{body()}</PageBody>
      </PageScroll>
    </Page>
  );
}
