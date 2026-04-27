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
 * The secrets file path is resolved in the same way as the backend:
 *   - SECRETS_FILE env var (highest priority)
 *   - Otherwise: <DATA_DIR>/secrets.yaml
 *   - DATA_DIR defaults to ./data relative to the project root
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data');
const SECRETS_FILE = process.env.SECRETS_FILE ?? path.join(DATA_DIR, 'secrets.yaml');

function load() {
  if (!fs.existsSync(SECRETS_FILE)) return { users: [] };
  const parsed = yaml.load(fs.readFileSync(SECRETS_FILE, 'utf8'));
  return parsed ?? { users: [] };
}

function save(data) {
  fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
  fs.writeFileSync(SECRETS_FILE, yaml.dump(data), 'utf8');
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'add': {
    const [username, password] = args;
    if (!username || !password) {
      console.error('Usage: add <username> <password>');
      process.exit(1);
    }
    const data = load();
    if (data.users.find(u => u.username === username)) {
      console.error(`User "${username}" already exists. Use passwd to change password.`);
      process.exit(1);
    }
    data.users.push({ username, password_hash: bcrypt.hashSync(password, 10) });
    save(data);
    console.log(`Added user: ${username}`);
    break;
  }

  case 'passwd': {
    const [username, password] = args;
    if (!username || !password) {
      console.error('Usage: passwd <username> <newpassword>');
      process.exit(1);
    }
    const data = load();
    const user = data.users.find(u => u.username === username);
    if (!user) {
      console.error(`User "${username}" not found`);
      process.exit(1);
    }
    user.password_hash = bcrypt.hashSync(password, 10);
    save(data);
    console.log(`Password updated for: ${username}`);
    break;
  }

  case 'delete': {
    const [username] = args;
    if (!username) {
      console.error('Usage: delete <username>');
      process.exit(1);
    }
    const data = load();
    const idx = data.users.findIndex(u => u.username === username);
    if (idx === -1) {
      console.error(`User "${username}" not found`);
      process.exit(1);
    }
    data.users.splice(idx, 1);
    save(data);
    console.log(`Deleted user: ${username}`);
    break;
  }

  case 'list': {
    const data = load();
    if (!data.users?.length) {
      console.log('No users configured.');
    } else {
      data.users.forEach(u => console.log(`  - ${u.username}`));
    }
    break;
  }

  default:
    console.log(`NexRev — user management

Commands:
  add <username> <password>     Add a new user
  passwd <username> <password>  Change a user's password
  delete <username>             Remove a user
  list                          List all users

Secrets file: ${SECRETS_FILE}
  Override with: SECRETS_FILE=/path/to/secrets.yaml node backend/scripts/manage-users.mjs ...
`);
}
