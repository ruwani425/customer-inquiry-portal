const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{7,20}$/;

export function isValidContact(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (EMAIL_REGEX.test(trimmed)) return true;
  const digitsOnly = trimmed.replace(/\D/g, '');
  return PHONE_REGEX.test(trimmed) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export interface NewInquiryFields {
  customerName: string;
  customerContact: string;
  subject: string;
  description: string;
}

export function validateNewInquiryForm(
  values: NewInquiryFields
): Partial<Record<keyof NewInquiryFields, string>> {
  const errors: Partial<Record<keyof NewInquiryFields, string>> = {};

  const name = values.customerName.trim();
  if (name.length < 2) {
    errors.customerName = 'Customer name must be at least 2 characters.';
  } else if (name.length > 100) {
    errors.customerName = 'Customer name cannot exceed 100 characters.';
  }

  const contact = values.customerContact.trim();
  if (!contact) {
    errors.customerContact = 'Please enter a customer email or phone number.';
  } else if (!isValidContact(contact)) {
    errors.customerContact =
      'Enter a valid email address or phone number (7–15 digits).';
  }

  const subject = values.subject.trim();
  if (subject.length < 3) {
    errors.subject = 'Subject must be at least 3 characters.';
  } else if (subject.length > 140) {
    errors.subject = 'Subject cannot exceed 140 characters.';
  }

  const description = values.description.trim();
  if (description.length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  } else if (description.length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  return errors;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

