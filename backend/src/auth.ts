import fs from 'fs';
import fsAsync from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import yaml from 'js-yaml';

const DATA_DIR_DEFAULT = path.join(process.cwd(), 'data');
export const SECRETS_FILE =
  process.env.SECRETS_FILE ??
  path.join(process.env.DATA_DIR ?? DATA_DIR_DEFAULT, 'secrets.yaml');

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET env var not set — using insecure default. Set it in production!');
}

interface User {
  username: string;
  password_hash: string;
  telegram_chat_id?: string;
}

interface Secrets {
  users: User[];
}

async function loadSecrets(): Promise<Secrets> {
  try {
    const content = await fsAsync.readFile(SECRETS_FILE, 'utf8');
    const parsed = yaml.load(content) as Secrets;
    return parsed ?? { users: [] };
  } catch {
    return { users: [] };
  }
}

async function saveSecrets(secrets: Secrets): Promise<void> {
  await fsAsync.mkdir(path.dirname(SECRETS_FILE), { recursive: true });
  await fsAsync.writeFile(SECRETS_FILE, yaml.dump(secrets), 'utf8');
}

export async function initSecrets(): Promise<void> {
  let secrets = await loadSecrets();
  
  // If user accounts are defined and 'admin' is present, remove 'admin'
  if (secrets.users?.length > 1) {
    const filtered = secrets.users.filter(u => u.username !== 'admin');
    if (filtered.length < secrets.users.length) {
      secrets.users = filtered;
      await saveSecrets(secrets);
      console.info('ℹ️  Removed default admin account because other user accounts are defined.');
    }
  }

  if (!secrets.users?.length) {
    const hash = await bcrypt.hash('admin', 10);
    await saveSecrets({ users: [{ username: 'admin', password_hash: hash }] });
    console.warn(
      '⚠️  Created default user (username: admin, password: admin). ' +
      'Change it using the Profile page or: node backend/scripts/manage-users.mjs passwd admin <newpassword>'
    );
  }
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const secrets = await loadSecrets();
  const user = secrets.users?.find(u => u.username === username);
  if (!user) return false;
  return bcrypt.compare(password, user.password_hash);
}

export function signToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { username: string } {
  return jwt.verify(token, JWT_SECRET) as { username: string };
}

export async function setTelegramChatId(username: string, chatId: string | null): Promise<void> {
  const secrets = await loadSecrets();
  const user = secrets.users.find(u => u.username === username);
  if (user) {
    user.telegram_chat_id = chatId ?? undefined;
    await saveSecrets(secrets);
  }
}

export async function getTelegramUsers(): Promise<{ username: string, telegram_chat_id: string }[]> {
  const secrets = await loadSecrets();
  return (secrets.users ?? [])
    .filter(u => !!u.telegram_chat_id)
    .map(u => ({ username: u.username, telegram_chat_id: u.telegram_chat_id! }));
}

export async function getUser(username: string): Promise<User | null> {
  const secrets = await loadSecrets();
  return secrets.users.find(u => u.username === username) ?? null;
}

export async function updatePassword(username: string, newPassword: string): Promise<void> {
  const secrets = await loadSecrets();
  const user = secrets.users.find(u => u.username === username);
  if (user) {
    user.password_hash = await bcrypt.hash(newPassword, 10);
    await saveSecrets(secrets);
  }
}
