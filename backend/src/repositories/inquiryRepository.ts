import { Pool } from 'pg';
import {
  normalizeContactForDuplicateCheck,
  normalizeSubjectForDuplicateCheck,
} from '../domain/inquiryRules.js';
import { InquiryRecord, InquiryStatus, PublicUser } from '../types.js';

export interface ListInquiriesFilter {
  user: PublicUser;
  status?: InquiryStatus;
  search?: string;
}

export interface CreateInquiryInput {
  customerName: string;
  customerContact: string;
  subject: string;
  description: string;
  ownerId: string;
}

export interface UpdateInquiryStatusInput {
  id: string;
  status: InquiryStatus;
  expectedVersion: number;
  lastNote: string | null;
  updatedById: string;
}

export interface InquiryRepository {
  list(filter: ListInquiriesFilter): Promise<InquiryRecord[]>;
  findById(id: string): Promise<InquiryRecord | null>;
  findActiveDuplicate(
    customerContact: string,
    subject: string
  ): Promise<InquiryRecord | null>;
  create(input: CreateInquiryInput): Promise<InquiryRecord>;
  updateStatus(input: UpdateInquiryStatusInput): Promise<InquiryRecord | null>;
}

interface InquiryRow {
  id: string;
  customer_name: string;
  customer_contact: string;
  subject: string;
  description: string;
  status: InquiryStatus;
  last_note: string | null;
  owner_id: string;
  owner_name: string;
  updated_by_id: string;
  updated_by_name: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

function mapInquiryRow(row: InquiryRow): InquiryRecord {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    subject: row.subject,
    description: row.description,
    status: row.status,
    lastNote: row.last_note,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    updatedById: row.updated_by_id,
    updatedByName: row.updated_by_name,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const BASE_SELECT = `
  SELECT
    i.id,
    i.customer_name,
    i.customer_contact,
    i.subject,
    i.description,
    i.status,
    i.last_note,
    i.owner_id,
    owner.name AS owner_name,
    i.updated_by_id,
    updater.name AS updated_by_name,
    i.version,
    i.created_at,
    i.updated_at
  FROM inquiries i
  JOIN users owner ON owner.id = i.owner_id
  JOIN users updater ON updater.id = i.updated_by_id
`;

export function createPgInquiryRepository(pool: Pool): InquiryRepository {
  return {
    async list({ user, status, search }: ListInquiriesFilter): Promise<InquiryRecord[]> {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (user.role !== 'supervisor') {
        params.push(user.id);
        conditions.push(`i.owner_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`i.status = $${params.length}`);
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        const idx = params.length;
        conditions.push(
          `(i.customer_name ILIKE $${idx} OR i.customer_contact ILIKE $${idx} OR i.subject ILIKE $${idx} OR COALESCE(i.last_note, '') ILIKE $${idx})`
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query<InquiryRow>(
        `${BASE_SELECT}
         ${whereClause}
         ORDER BY i.updated_at DESC, i.created_at DESC`,
        params
      );

      return result.rows.map(mapInquiryRow);
    },

    async findById(id: string): Promise<InquiryRecord | null> {
      const result = await pool.query<InquiryRow>(
        `${BASE_SELECT}
         WHERE i.id = $1
         LIMIT 1`,
        [id]
      );
      return result.rows[0] ? mapInquiryRow(result.rows[0]) : null;
    },

    async findActiveDuplicate(
      customerContact: string,
      subject: string
    ): Promise<InquiryRecord | null> {
      const normalizedContact = normalizeContactForDuplicateCheck(customerContact);
      const normalizedSubject = normalizeSubjectForDuplicateCheck(subject);

      const result = await pool.query<InquiryRow>(
        `${BASE_SELECT}
         WHERE i.status <> 'RESOLVED'
           AND (
             LOWER(TRIM(i.customer_contact)) = $1
             OR REGEXP_REPLACE(TRIM(i.customer_contact), '[\\s\\-().]', '', 'g') = $1
           )
           AND LOWER(REGEXP_REPLACE(TRIM(i.subject), '\\s+', ' ', 'g')) = $2
         LIMIT 1`,
        [normalizedContact, normalizedSubject]
      );

      return result.rows[0] ? mapInquiryRow(result.rows[0]) : null;
    },

    async create(input: CreateInquiryInput): Promise<InquiryRecord> {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO inquiries (
           customer_name,
           customer_contact,
           subject,
           description,
           status,
           owner_id,
           updated_by_id
         )
         VALUES ($1, $2, $3, $4, 'NEW', $5, $5)
         RETURNING id`,
        [
          input.customerName,
          input.customerContact,
          input.subject,
          input.description,
          input.ownerId,
        ]
      );

      const created = await this.findById(inserted.rows[0].id);
      if (!created) {
        throw new Error('Created inquiry could not be loaded.');
      }
      return created;
    },

    async updateStatus(
      input: UpdateInquiryStatusInput
    ): Promise<InquiryRecord | null> {
      const updated = await pool.query<{ id: string }>(
        `UPDATE inquiries
         SET status = $1,
             last_note = COALESCE($2, last_note),
             updated_by_id = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4 AND version = $5
         RETURNING id`,
        [
          input.status,
          input.lastNote,
          input.updatedById,
          input.id,
          input.expectedVersion,
        ]
      );

      if (!updated.rowCount || updated.rowCount === 0) {
        return null;
      }

      return this.findById(updated.rows[0].id);
    },
  };
}

