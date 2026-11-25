export type UserRole = 'staff' | 'supervisor';

export type InquiryStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Inquiry {
  id: string;
  customerName: string;
  customerContact: string;
  subject: string;
  description: string;
  status: InquiryStatus;
  lastNote: string | null;
  ownerId: string;
  ownerName: string;
  updatedById: string;
  updatedByName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    existingInquiryId?: string;
    currentInquiry?: Inquiry;
  };
}

