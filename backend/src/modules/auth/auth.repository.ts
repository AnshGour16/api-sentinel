import { query } from '../../lib/db';
import { User } from './auth.types';

export class AuthRepository {
  async findById(id: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, name, created_at FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async upsertUser(email: string, name?: string): Promise<User> {
    const result = await query<User>(
      `INSERT INTO users (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email)
       DO UPDATE SET
         name = COALESCE($2, users.name)
       RETURNING id, email, name, created_at`,
      [email, name || null]
    );
    return result.rows[0];
  }
}

export const authRepository = new AuthRepository();
