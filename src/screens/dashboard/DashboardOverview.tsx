import Header from '../../components/Header';
import { Page, PageContent } from '../../components/ui';
import ModuleReports from './ModuleReports';

// Dashboard & Report: KPI cards, charts and the supplier list of each module, filtered together.
export default function DashboardOverview() {
  return (
    <Page>
      <Header breadcrumb={['Overview']} title="Dashboard & Report" />
      <PageContent><ModuleReports /></PageContent>
    </Page>
  );
}
