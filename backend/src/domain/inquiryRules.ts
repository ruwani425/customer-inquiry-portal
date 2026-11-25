import { InquiryRecord, InquiryStatus, PublicUser } from '../types.js';

export const ALLOWED_STATUS_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  NEW: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
};

export function isValidStatusTransition(
  currentStatus: InquiryStatus,
  nextStatus: InquiryStatus
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

/**
 * Staff members can only view and manage inquiries assigned to them.
 * Supervisors can view and manage all inquiries across the team.
 */
export function canAccessInquiry(
  user: Pick<PublicUser, 'id' | 'role'>,
  inquiry: Pick<InquiryRecord, 'ownerId'>
): boolean {
  if (user.role === 'supervisor') {
    return true;
  }
  return inquiry.ownerId === user.id;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{7,20}$/;

export function isValidCustomerContact(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (EMAIL_REGEX.test(trimmed)) return true;
  const digitsOnly = trimmed.replace(/\D/g, '');
  return PHONE_REGEX.test(trimmed) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export function normalizeContactForDuplicateCheck(value: string): string {
  const trimmed = value.trim();
  if (EMAIL_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/[\s\-().]/g, '');
}

export function normalizeSubjectForDuplicateCheck(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

