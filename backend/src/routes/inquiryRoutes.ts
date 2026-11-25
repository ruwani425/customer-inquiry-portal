import { Router } from 'express';
import { z } from 'zod';
import {
  canAccessInquiry,
  isValidCustomerContact,
  isValidStatusTransition,
} from '../domain/inquiryRules.js';
import { AppError } from '../errors.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { InquiryRepository } from '../repositories/inquiryRepository.js';
import { InquiryStatus } from '../types.js';

const uuidSchema = z.string().uuid('Invalid inquiry ID format.');

const statusEnum = z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']);

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  q: z.string().trim().max(120).optional(),
});

const createInquirySchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters.')
    .max(100, 'Customer name cannot exceed 100 characters.'),
  customerContact: z
    .string()
    .trim()
    .min(5, 'Provide an email address or phone number.')
    .max(120, 'Contact info cannot exceed 120 characters.')
    .refine(
      isValidCustomerContact,
      'Enter a valid email address or phone number (7–15 digits).'
    ),
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters.')
    .max(140, 'Subject cannot exceed 140 characters.'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters.')
    .max(2000, 'Description cannot exceed 2000 characters.'),
});

const updateStatusSchema = z.object({
  status: statusEnum,
  expectedVersion: z
    .number({ invalid_type_error: 'expectedVersion must be a number.' })
    .int()
    .positive(),
  lastNote: z
    .string()
    .trim()
    .max(280, 'Note cannot exceed 280 characters.')
    .optional(),
});

function buildTransitionErrorMessage(
  currentStatus: InquiryStatus,
  nextStatus: InquiryStatus
): string {
  if (currentStatus === nextStatus) {
    return `Inquiry is already in ${currentStatus.replace('_', ' ')} status.`;
  }
  if (currentStatus === 'RESOLVED') {
    return 'Resolved inquiries cannot be reopened. Log a new inquiry for follow-up requests.';
  }
  if (currentStatus === 'NEW' && nextStatus === 'RESOLVED') {
    return 'New inquiries must move to In Progress before being marked Resolved.';
  }
  return `Cannot move inquiry from ${currentStatus} to ${nextStatus}.`;
}

export function createInquiryRouter(inquiryRepo: InquiryRepository): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = listQuerySchema.parse({
        status: req.query.status || undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
      });

      const inquiries = await inquiryRepo.list({
        user: req.user!,
        status: parsed.status,
        search: parsed.q,
      });

      res.status(200).json({ inquiries });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = createInquirySchema.parse(req.body);

      const duplicate = await inquiryRepo.findActiveDuplicate(
        input.customerContact,
        input.subject
      );

      if (duplicate) {
        throw new AppError(
          409,
          'DUPLICATE_INQUIRY',
          'An open inquiry with this contact and subject already exists.',
          { existingInquiryId: duplicate.id }
        );
      }

      const inquiry = await inquiryRepo.create({
        ...input,
        ownerId: req.user!.id,
      });

      res.status(201).json({ inquiry });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const idParse = uuidSchema.safeParse(req.params.id);
      if (!idParse.success) {
        throw new AppError(400, 'INVALID_ID', 'Invalid inquiry ID format.');
      }

      const inquiry = await inquiryRepo.findById(idParse.data);
      if (!inquiry) {
        throw new AppError(404, 'NOT_FOUND', 'Inquiry not found.');
      }

      if (!canAccessInquiry(req.user!, inquiry)) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'You do not have permission to view this inquiry.'
        );
      }

      res.status(200).json({ inquiry });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/status', async (req: AuthenticatedRequest, res, next) => {
    try {
      const idParse = uuidSchema.safeParse(req.params.id);
      if (!idParse.success) {
        throw new AppError(400, 'INVALID_ID', 'Invalid inquiry ID format.');
      }

      const body = updateStatusSchema.parse(req.body);

      const existing = await inquiryRepo.findById(idParse.data);
      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Inquiry not found.');
      }

      if (!canAccessInquiry(req.user!, existing)) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'You do not have permission to update this inquiry.'
        );
      }

      if (existing.version !== body.expectedVersion) {
        throw new AppError(
          409,
          'STALE_INQUIRY',
          'This inquiry was updated elsewhere. Refresh to see the latest status before saving.',
          { currentInquiry: existing }
        );
      }

      if (!isValidStatusTransition(existing.status, body.status)) {
        throw new AppError(
          409,
          'INVALID_STATUS_TRANSITION',
          buildTransitionErrorMessage(existing.status, body.status)
        );
      }

      const normalizedNote =
        body.lastNote && body.lastNote.length > 0 ? body.lastNote : null;

      const updated = await inquiryRepo.updateStatus({
        id: existing.id,
        status: body.status,
        expectedVersion: body.expectedVersion,
        lastNote: normalizedNote,
        updatedById: req.user!.id,
      });

      if (!updated) {
        const latest = await inquiryRepo.findById(existing.id);
        throw new AppError(
          409,
          'STALE_INQUIRY',
          'This inquiry was updated elsewhere. Refresh to see the latest status before saving.',
          latest ? { currentInquiry: latest } : undefined
        );
      }

      res.status(200).json({ inquiry: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

