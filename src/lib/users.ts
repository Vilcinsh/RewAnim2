import getDb from './db';
import { createHash } from 'crypto';

export type User = {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
};

function hashPassword(password: string): string {
  return createHash('sha256').update(password + process.env.AUTH_SECRET).digest('hex');
}

export function findUserByCredentials(username: string, password: string): User | null {
  const db = getDb();
  const hash = hashPassword(password);
  const user = db.prepare(
    'SELECT id, username, role, created_at FROM users WHERE username = ? AND password_hash = ?'
  ).get(username, hash) as User | undefined;
  return user ?? null;
}

export function getAllUsers(): User[] {
  const db = getDb();
  return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all() as User[];
}

export function createUser(username: string, password: string, role: 'admin' | 'user' = 'user'): User {
  const db = getDb();
  const hash = hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, role);
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as User;
}

export function deleteUser(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function updateUserPassword(id: number, newPassword: string): void {
  const db = getDb();
  const hash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
}

export function userCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count;
}
