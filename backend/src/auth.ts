import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET env var not set — using insecure default. Set it in production!');
}

interface User {
  username: string;
  password_hash: string;
  telegram_chat_id?: string;
}

function mapUser(row: {
  username: string;
  password_hash: string;
  telegram_chat_id: string | null;
}): User {
  return {
    username: row.username,
    password_hash: row.password_hash,
    telegram_chat_id: row.telegram_chat_id ?? undefined,
  };
}

async function createDefaultAdmin(): Promise<void> {
  const db = getDb();
  const hash = await bcrypt.hash('admin', 10);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (username, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(username) DO NOTHING
  `).run('admin', hash, now, now);

  console.warn(
    '⚠️  Created default user (username: admin, password: admin). ' +
      'Change it using the Profile page or: node backend/scripts/manage-users.mjs passwd admin <newpassword>'
  );
}

export async function initSecrets(): Promise<void> {
  const db = getDb();

  const users = db
    .prepare('SELECT username FROM users ORDER BY username ASC')
    .all() as Array<{ username: string }>;

  // Remove default admin when custom users are present.
  if (users.length > 1 && users.some((u) => u.username === 'admin')) {
    db.prepare('DELETE FROM users WHERE username = ?').run('admin');
    console.info('ℹ️  Removed default admin account because other user accounts are defined.');
    return;
  }

  if (users.length === 0) {
    await createDefaultAdmin();
  }
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const db = getDb();
  const row = db
    .prepare('SELECT password_hash FROM users WHERE username = ?')
    .get(username) as { password_hash: string } | undefined;

  if (!row) return false;
  return bcrypt.compare(password, row.password_hash);
}

export function signToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { username: string } {
  return jwt.verify(token, JWT_SECRET) as { username: string };
}

export async function setTelegramChatId(username: string, chatId: string | null): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE users SET telegram_chat_id = ?, updated_at = ? WHERE username = ?`
  ).run(chatId, now, username);
}

export async function getTelegramUsers(): Promise<{ username: string; telegram_chat_id: string }[]> {
  const db = getDb();
  return db
    .prepare(`
      SELECT username, telegram_chat_id
      FROM users
      WHERE telegram_chat_id IS NOT NULL
      ORDER BY username ASC
    `)
    .all()
    .map((row) => ({
      username: (row as { username: string }).username,
      telegram_chat_id: (row as { telegram_chat_id: string }).telegram_chat_id,
    }));
}

export async function getUser(username: string): Promise<User | null> {
  const db = getDb();
  const row = db
    .prepare('SELECT username, password_hash, telegram_chat_id FROM users WHERE username = ?')
    .get(username) as
    | { username: string; password_hash: string; telegram_chat_id: string | null }
    | undefined;

  if (!row) return null;
  return mapUser(row);
}

export async function updatePassword(username: string, newPassword: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?').run(
    hash,
    now,
    username
  );
}
