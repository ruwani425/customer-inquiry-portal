import { describe, expect, it } from 'vitest';
import {
  canAccessInquiry,
  isValidCustomerContact,
  isValidStatusTransition,
  normalizeContactForDuplicateCheck,
  normalizeSubjectForDuplicateCheck,
} from './inquiryRules.js';

describe('inquiryRules', () => {
  describe('isValidStatusTransition', () => {
    it('allows linear progression NEW -> IN_PROGRESS -> RESOLVED', () => {
      expect(isValidStatusTransition('NEW', 'IN_PROGRESS')).toBe(true);
      expect(isValidStatusTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
    });

    it('rejects skipping IN_PROGRESS, no-op transitions, and reopening RESOLVED', () => {
      expect(isValidStatusTransition('NEW', 'RESOLVED')).toBe(false);
      expect(isValidStatusTransition('NEW', 'NEW')).toBe(false);
      expect(isValidStatusTransition('IN_PROGRESS', 'NEW')).toBe(false);
      expect(isValidStatusTransition('RESOLVED', 'IN_PROGRESS')).toBe(false);
      expect(isValidStatusTransition('RESOLVED', 'NEW')).toBe(false);
    });
  });  

  describe('canAccessInquiry', () => {
    it('allows staff to access only their own inquiries', () => {
      expect(
        canAccessInquiry({ id: 'user-1', role: 'staff' }, { ownerId: 'user-1' })
      ).toBe(true);
      expect(
        canAccessInquiry({ id: 'user-1', role: 'staff' }, { ownerId: 'user-2' })
      ).toBe(false);
    });

    it('allows supervisors to access any inquiry', () => {
      expect(
        canAccessInquiry(
          { id: 'lead-1', role: 'supervisor' },
          { ownerId: 'user-2' }
        )
      ).toBe(true);
    });
  });

  describe('isValidCustomerContact', () => {
    it('accepts valid emails and phone numbers', () => {
      expect(isValidCustomerContact('amara@example.com')).toBe(true);
      expect(isValidCustomerContact('+94 77 412 8890')).toBe(true);
      expect(isValidCustomerContact('0774128890')).toBe(true);
    });

    it('rejects empty or invalid contact strings', () => {
      expect(isValidCustomerContact('')).toBe(false);
      expect(isValidCustomerContact('not-an-email')).toBe(false);
      expect(isValidCustomerContact('12345')).toBe(false);
    });
  });

  describe('duplicate normalization', () => {
    it('normalizes email casing and phone punctuation', () => {
      expect(normalizeContactForDuplicateCheck('  Maya@Example.COM ')).toBe(
        'maya@example.com'
      );
      expect(normalizeContactForDuplicateCheck('+94 (77) 412-8890')).toBe(
        '+94774128890'
      );
      expect(normalizeSubjectForDuplicateCheck('  Invoice   Issue  ')).toBe(
        'invoice issue'
      );
    });
  });
});

