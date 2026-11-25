import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors.js';
import {
  AuthenticatedRequest,
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signSessionToken,
} from '../middleware/auth.js';
import { UserRepository } from '../repositories/userRepository.js';
import { PublicUser } from '../types.js';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid work email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export function createAuthRouter(userRepo: UserRepository): Router {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await userRepo.findByEmail(email);

      if (!user) {
        throw new AppError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid email or password.'
        );
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        throw new AppError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid email or password.'
        );
      }

      const publicUser: PublicUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      const token = signSessionToken(publicUser);
      setSessionCookie(res, token);

      res.status(200).json({ user: publicUser });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  });

  router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.status(200).json({ user: req.user });
  });

  return router;
}

