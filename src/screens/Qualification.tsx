import { useState } from 'react';
import Header from '../components/Header';
import { suppliers as supplierDirectory } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { demoActors } from '../qsl/actors';
import { can } from '../qsl/rbac';
import type { NextAction } from '../qsl/services/queries';
import { prefillReassessment, type RequestInput } from '../qsl/services/assessments';
import { sectionLabel } from '../modules';
import { BackLink, Button, Callout, Page, PageBody, PageScroll } from '../components/ui';
import { QualifiedTab } from './qualification/QualifiedTab';
import { ManagementTab } from './qualification/Management';
import { RequalificationTab } from './qualification/Requalification';
import { RequestModal } from './qualification/RequestModal';
import { ResultDetail } from './qualification/ResultDetail';
import { ReviewPage } from './qualification/ReviewPage';
import { StagePage } from './qualification/StagePage';
import { errorMessage } from './qualification/shared';

type PageState = { type: 'detail' | 'review' | 'prereview' | 'sample'; id: string } | null;
type ModalState = { draftId?: string; prefill?: RequestInput } | null;

const pageTitle = {
  detail: 'Result and history', review: 'Assess / approve', prereview: 'Pre-Qualification Review',
  sample: 'Sample Evaluation',
} as const;

// Module 4: Supplier Qualification & Capability. Sections follow the flow: waiting for qualification -> qualified -> requalification.
export default function Qualification() {
  const { role, section, setSection, openSupplier } = useNavigation();
  const actor = demoActors[role];
  const [page, setPage] = useState<PageState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);
  const title = sectionLabel('qualification', role, section) ?? 'Qualification & Capability';
  const canCreate = can(actor, 'qsl.create');

  const openDetail = (id: string) => { setPage({ type: 'detail', id }); setError(null); };
  const proceed = (id: string, action: Exclude<NextAction, null>) => {
    if (action === 'edit') setModal({ draftId: id });
    else if (action === 'prereview' || action === 'sample') setPage({ type: action, id });
    else setPage({ type: 'review', id });
  };
  const reassess = (previousId: string) => {
    try { setModal({ prefill: prefillReassessment(actor, previousId) }); } catch (caught) { setError(errorMessage(caught).message); }
  };
  const openProfile = (supplierId: string, tab = 'Qualification') => {
    const supplier = supplierDirectory.find(item => item.id === supplierId);
    if (supplier) openSupplier(supplier, tab);
  };
  const close = () => setPage(null);

  const body = () => {
    if (page?.type === 'detail') return <ResultDetail actor={actor} id={page.id} onOpen={openDetail} onContinue={proceed} onReassess={reassess} onProfile={openProfile} />;
    if (page?.type === 'review') return <ReviewPage actor={actor} id={page.id} onDone={close} />;
    if (page?.type === 'prereview' || page?.type === 'sample') return <StagePage actor={actor} id={page.id} mode={page.type} onDone={close} />;
    const newRequestButton = canCreate ? <Button variant="primary" onClick={() => setModal({})}>+ New Qualification Request</Button> : undefined;
    switch (section) {
      case 'requalification': return <RequalificationTab actor={actor} onOpen={openDetail} onContinue={proceed} onStart={reassess} />;
      case 'qualified': return <QualifiedTab actor={actor} onOpen={openDetail} onProfile={openProfile} actions={newRequestButton} />;
      default: return (
        <ManagementTab actor={actor} onOpen={openDetail} onContinue={proceed}
          actions={newRequestButton} />
      );
    }
  };

  return (
    <Page>
      <Header
        breadcrumb={['Supplier lifecycle', 'Qualification & Capability']}
        title={title}
      />
      <PageScroll>
        <PageBody>
          {error && <Callout tone="danger" title={error} />}
          {page && (
            <div className="space-y-1">
              <BackLink onClick={close}>{`Back to ${title}`}</BackLink>
              <div className="text-caption text-ink-muted">{title} / {pageTitle[page.type]}</div>
            </div>
          )}
          {body()}
        </PageBody>
      </PageScroll>
      {modal && (
        <RequestModal
          actor={actor}
          draftId={modal.draftId}
          prefill={modal.prefill}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); setPage(null); setSection('pending'); }}
        />
      )}
    </Page>
  );
}
