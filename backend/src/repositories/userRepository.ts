import { Pool } from 'pg';
import { UserRecord } from '../types.js';

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'staff' | 'supervisor';
  password_hash: string;
  created_at: Date;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
  };
}

export function createPgUserRepository(pool: Pool): UserRepository {
  return {
    async findByEmail(email: string): Promise<UserRecord | null> {
      const result = await pool.query<UserRow>(
        `SELECT id, email, name, role, password_hash, created_at
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [email.trim()]
      );
      return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    },

    async findById(id: string): Promise<UserRecord | null> {
      const result = await pool.query<UserRow>(
        `SELECT id, email, name, role, password_hash, created_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    },
  };
}

