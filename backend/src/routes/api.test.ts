import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  normalizeContactForDuplicateCheck,
  normalizeSubjectForDuplicateCheck,
} from '../domain/inquiryRules.js';
import {
  CreateInquiryInput,
  InquiryRepository,
  ListInquiriesFilter,
  UpdateInquiryStatusInput,
} from '../repositories/inquiryRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { InquiryRecord, UserRecord } from '../types.js';

function createInMemoryRepos() {
  const passwordHash = bcrypt.hashSync('Password123!', 4);

  const users: UserRecord[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'maya@coffeeninja.local',
      name: 'Maya Perera',
      role: 'staff',
      passwordHash,
      createdAt: new Date().toISOString(),
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'liam@coffeeninja.local',
      name: 'Liam Fernando',
      role: 'staff',
      passwordHash,
      createdAt: new Date().toISOString(),
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'nadia@coffeeninja.local',
      name: 'Nadia Silva',
      role: 'supervisor',
      passwordHash,
      createdAt: new Date().toISOString(),
    },
  ];

  const inquiries: InquiryRecord[] = [];

  const userRepo: UserRepository = {
    async findByEmail(email) {
      return (
        users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ??
        null
      );
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
  };

  const inquiryRepo: InquiryRepository = {
    async list({ user, status, search }: ListInquiriesFilter) {
      return inquiries.filter((item) => {
        if (user.role !== 'supervisor' && item.ownerId !== user.id) return false;
        if (status && item.status !== status) return false;
        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          const haystack = [
            item.customerName,
            item.customerContact,
            item.subject,
            item.lastNote ?? '',
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      });
    },
    async findById(id) {
      return inquiries.find((item) => item.id === id) ?? null;
    },
    async findActiveDuplicate(customerContact, subject) {
      const targetContact = normalizeContactForDuplicateCheck(customerContact);
      const targetSubject = normalizeSubjectForDuplicateCheck(subject);
      return (
        inquiries.find(
          (item) =>
            item.status !== 'RESOLVED' &&
            normalizeContactForDuplicateCheck(item.customerContact) ===
              targetContact &&
            normalizeSubjectForDuplicateCheck(item.subject) === targetSubject
        ) ?? null
      );
    },
    async create(input: CreateInquiryInput) {
      const owner = users.find((u) => u.id === input.ownerId)!;
      const now = new Date().toISOString();
      const record: InquiryRecord = {
        id: randomUUID(),
        customerName: input.customerName,
        customerContact: input.customerContact,
        subject: input.subject,
        description: input.description,
        status: 'NEW',
        lastNote: null,
        ownerId: owner.id,
        ownerName: owner.name,
        updatedById: owner.id,
        updatedByName: owner.name,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      inquiries.unshift(record);
      return record;
    },
    async updateStatus(input: UpdateInquiryStatusInput) {
      const idx = inquiries.findIndex(
        (item) => item.id === input.id && item.version === input.expectedVersion
      );
      if (idx === -1) return null;
      const updater = users.find((u) => u.id === input.updatedById)!;
      const updated: InquiryRecord = {
        ...inquiries[idx],
        status: input.status,
        lastNote: input.lastNote ?? inquiries[idx].lastNote,
        updatedById: updater.id,
        updatedByName: updater.name,
        version: inquiries[idx].version + 1,
        updatedAt: new Date().toISOString(),
      };
      inquiries[idx] = updated;
      return updated;
    },
  };

  return { userRepo, inquiryRepo };
}

describe('Customer Inquiry API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const repos = createInMemoryRepos();
    app = createApp(repos);
  });

  async function loginAs(email: string) {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password: 'Password123!' });
    expect(res.status).toBe(200);
    return agent;
  }

  it('enforces authentication on inquiry endpoints', async () => {
    const res = await request(app).get('/api/inquiries');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid login credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maya@coffeeninja.local', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects missing or invalid inquiry fields with field-level errors', async () => {
    const maya = await loginAs('maya@coffeeninja.local');
    const res = await maya.post('/api/inquiries').send({
      customerName: 'A',
      customerContact: 'bad-contact',
      subject: 'Hi',
      description: 'Short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toMatchObject({
      customerName: expect.any(String),
      customerContact: expect.any(String),
      subject: expect.any(String),
      description: expect.any(String),
    });
  });

  it('enforces ownership when another staff member opens a direct link, while supervisors can access all', async () => {
    const maya = await loginAs('maya@coffeeninja.local');
    const liam = await loginAs('liam@coffeeninja.local');
    const nadia = await loginAs('nadia@coffeeninja.local');

    const created = await maya.post('/api/inquiries').send({
      customerName: 'Amara Wijesinghe',
      customerContact: 'amara@example.com',
      subject: 'Invoice correction',
      description: 'Please update the billing address on invoice #INV-2041.',
    });
    expect(created.status).toBe(201);
    const inquiryId = created.body.inquiry.id;

    // Liam cannot view or modify Maya's inquiry even via direct ID
    const liamView = await liam.get(`/api/inquiries/${inquiryId}`);
    expect(liamView.status).toBe(403);
    expect(liamView.body.error.code).toBe('FORBIDDEN');

    const liamPatch = await liam
      .patch(`/api/inquiries/${inquiryId}/status`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 });
    expect(liamPatch.status).toBe(403);

    // Nadia (supervisor) can view Maya's inquiry
    const nadiaView = await nadia.get(`/api/inquiries/${inquiryId}`);
    expect(nadiaView.status).toBe(200);
    expect(nadiaView.body.inquiry.id).toBe(inquiryId);
  });

  it('enforces lifecycle rules, duplicate prevention, and optimistic locking for stale tabs', async () => {
    const maya = await loginAs('maya@coffeeninja.local');

    const created = await maya.post('/api/inquiries').send({
      customerName: 'Daniel Jayawardena',
      customerContact: '+94 77 412 8890',
      subject: 'Service reschedule',
      description: 'Need to move machine maintenance to Monday morning.',
    });
    expect(created.status).toBe(201);
    const inquiry = created.body.inquiry;

    // Duplicate open inquiry is rejected
    const duplicate = await maya.post('/api/inquiries').send({
      customerName: 'Daniel Jayawardena',
      customerContact: '94774128890'.replace(/^/, '+'),
      subject: '  service   reschedule ',
      description: 'Resending the same request.',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_INQUIRY');

    // Cannot skip IN_PROGRESS
    const skipRes = await maya
      .patch(`/api/inquiries/${inquiry.id}/status`)
      .send({ status: 'RESOLVED', expectedVersion: 1 });
    expect(skipRes.status).toBe(409);
    expect(skipRes.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    // Tab 1 moves NEW -> IN_PROGRESS (version 1 -> 2)
    const tab1Update = await maya
      .patch(`/api/inquiries/${inquiry.id}/status`)
      .send({
        status: 'IN_PROGRESS',
        expectedVersion: 1,
        lastNote: 'Called customer to confirm 10 AM slot.',
      });
    expect(tab1Update.status).toBe(200);
    expect(tab1Update.body.inquiry.version).toBe(2);
    expect(tab1Update.body.inquiry.status).toBe('IN_PROGRESS');

    // Tab 2 still has version 1 and attempts an update -> 409 STALE_INQUIRY
    const tab2StaleUpdate = await maya
      .patch(`/api/inquiries/${inquiry.id}/status`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 });
    expect(tab2StaleUpdate.status).toBe(409);
    expect(tab2StaleUpdate.body.error.code).toBe('STALE_INQUIRY');
    expect(tab2StaleUpdate.body.error.currentInquiry.version).toBe(2);

    // Move IN_PROGRESS -> RESOLVED
    const resolved = await maya
      .patch(`/api/inquiries/${inquiry.id}/status`)
      .send({
        status: 'RESOLVED',
        expectedVersion: 2,
        lastNote: 'Confirmed Monday 10 AM booking via SMS.',
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body.inquiry.status).toBe('RESOLVED');

    // Cannot reopen RESOLVED inquiry
    const reopen = await maya
      .patch(`/api/inquiries/${inquiry.id}/status`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 3 });
    expect(reopen.status).toBe(409);
    expect(reopen.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('returns predictable 400 and 404 responses for invalid or missing IDs', async () => {
    const maya = await loginAs('maya@coffeeninja.local');

    const invalidIdRes = await maya.get('/api/inquiries/not-a-uuid');
    expect(invalidIdRes.status).toBe(400);
    expect(invalidIdRes.body.error.code).toBe('INVALID_ID');

    const missingRes = await maya.get(
      '/api/inquiries/99999999-9999-4999-8999-999999999999'
    );
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.error.code).toBe('NOT_FOUND');
  });
});

