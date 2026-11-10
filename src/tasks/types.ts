import type { ReviewWorkflow } from '../config/types.ts';

export type TaskStatus = 'Draft' | 'Assigned' | 'In Progress' | 'Submitted' | 'Under Review' | 'Returned' | 'Approved' | 'Rejected' | 'Completed' | 'Overdue';
type StoredStatus = Exclude<TaskStatus, 'Overdue'>;
export type ReviewDecision = 'Approved' | 'Returned' | 'Rejected';

export type TaskActor = { name: string; role: string };
type TaskReview = { step: 1 | 2; role: string; decision: ReviewDecision; comment: string; by: string; at: string; revision: number };
type TaskSubmission = { revision: number; submittedAt: string; transactionId: string; answers: Record<string, string>; files: string[]; note: string };
type TaskHistoryEntry = { at: string; by: string; action: string; note?: string };

// The review workflow is copied from the task type when the task is created, so later settings changes do not alter tasks in progress.
type TaskWorkflow = { type: ReviewWorkflow; reviewerRole: string; secondReviewerRole?: string; allowReturn: boolean };

export type Task = {
  id: string;
  supplierId: string;
  taskTypeId: string;
  taskTypeName: string;
  templateId?: string;
  title: string;
  instructions: string;
  requiredForms: string;
  requiredDocuments: string;
  owner: string;
  dueDate: string;
  status: StoredStatus;
  workflow: TaskWorkflow;
  reviewStep: 1 | 2;
  submissions: TaskSubmission[];
  reviews: TaskReview[];
  history: TaskHistoryEntry[];
  assignRevision: number;
  assignTransactionId?: string;
  portalSync?: 'Sent' | 'Failed';
  createdAt: string;
  updatedAt: string;
};

export type TaskFilter = { status?: TaskStatus; supplierId?: string; taskTypeId?: string; search?: string; reviewerRole?: string };
