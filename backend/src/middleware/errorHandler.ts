import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ?? {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'body';
      if (!fields[key]) {
        fields[key] = issue.message;
      }
    }
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields and try again.',
        fields,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON request body.',
      },
    });
    return;
  }

  const pgCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: string }).code
      : undefined;

  if (pgCode === '22P02') {
    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid identifier or parameter format.',
      },
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on the server. Please try again.',
    },
  });
}

