import { InquiryStatus } from '../types';

const STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
};

const STATUS_CLASSES: Record<InquiryStatus, string> = {
  NEW: 'badge badge--new',
  IN_PROGRESS: 'badge badge--progress',
  RESOLVED: 'badge badge--resolved',
};

export function StatusBadge({ status }: { status: InquiryStatus }) {
  return <span className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</span>;
}

export function formatStatusLabel(status: InquiryStatus): string {
  return STATUS_LABELS[status];
}

