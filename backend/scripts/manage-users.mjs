#!/usr/bin/env node
/**
 * NexRev — user management
 *
 * Usage (run from project root):
 *   node backend/scripts/manage-users.mjs add <username> <password>
 *   node backend/scripts/manage-users.mjs passwd <username> <newpassword>
 *   node backend/scripts/manage-users.mjs delete <username>
 *   node backend/scripts/manage-users.mjs list
 *
 * The SQLite path is resolved as:
 *   - SQLITE_FILE env var (highest priority)
 *   - Otherwise: <DATA_DIR>/nexrev.sqlite3
 *   - DATA_DIR defaults to ./data relative to the project root
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data');
const SQLITE_FILE = process.env.SQLITE_FILE ?? path.join(DATA_DIR, 'nexrev.sqlite3');

function initDb() {
  fs.mkdirSync(path.dirname(SQLITE_FILE), { recursive: true });
  const db = new Database(SQLITE_FILE);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      telegram_chat_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id
      ON users(telegram_chat_id);
  `);
  return db;
}

const db = initDb();
const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'add': {
    const [username, password] = args;
    if (!username || !password) {
      console.error('Usage: add <username> <password>');
      process.exit(1);
    }

    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    if (exists) {
      console.error(`User "${username}" already exists. Use passwd to change password.`);
      process.exit(1);
    }

    const now = new Date().toISOString();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(username, hash, now, now);

    console.log(`Added user: ${username}`);
    break;
  }

  case 'passwd': {
    const [username, password] = args;
    if (!username || !password) {
      console.error('Usage: passwd <username> <newpassword>');
      process.exit(1);
    }

    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!user) {
      console.error(`User "${username}" not found`);
      process.exit(1);
    }

    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?').run(
      hash,
      now,
      username
    );

    console.log(`Password updated for: ${username}`);
    break;
  }

  case 'delete': {
    const [username] = args;
    if (!username) {
      console.error('Usage: delete <username>');
      process.exit(1);
    }

    const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);
    if (result.changes === 0) {
      console.error(`User "${username}" not found`);
      process.exit(1);
    }

    console.log(`Deleted user: ${username}`);
    break;
  }

  case 'list': {
    const users = db
      .prepare('SELECT username, telegram_chat_id FROM users ORDER BY username ASC')
      .all();

    if (!users.length) {
      console.log('No users configured.');
      break;
    }

    users.forEach((user) => {
      const row = user;
      const username = row.username;
      const marker = row.telegram_chat_id ? ' (telegram linked)' : '';
      console.log(`  - ${username}${marker}`);
    });
    break;
  }

  default:
    console.log(`NexRev — user management

Commands:
  add <username> <password>     Add a new user
  passwd <username> <password>  Change a user's password
  delete <username>             Remove a user
  list                          List all users

SQLite file: ${SQLITE_FILE}
  Override with: SQLITE_FILE=/path/to/nexrev.sqlite3 node backend/scripts/manage-users.mjs ...
`);
}

db.close();
