export const sourcingStages = ['Interested', 'Shortlisted', 'Under Review', 'Selected', 'Not Selected'] as const;
export type SourcingStage = (typeof sourcingStages)[number];

export type SourcingAction = 'Marked as interested' | 'Stage changed' | 'Assigned' | 'Removed from sourcing';

export type SourcingActor = { name: string };

export type SourcingRecord = {
  supplierId: string;
  stage: SourcingStage;
  assignee: string;
  interestedBy: string;
  interestedAt: string;
  updatedAt: string;
};

export type SourcingActivity = {
  id: string;
  supplierId: string;
  at: string;
  by: string;
  action: SourcingAction;
  from?: SourcingStage;
  to?: SourcingStage;
  assignee?: string;
  note?: string;
};

export type SourcingFilter = { stage?: SourcingStage; assignee?: string; search?: string };
export type ActivityFilter = { supplierId?: string; action?: SourcingAction; search?: string };

export type SourcingSummary = {
  total: number;
  inProgress: number;
  byStage: Record<SourcingStage, number>;
};
