#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data');
const SQLITE_FILE = process.env.SQLITE_FILE ?? path.join(DATA_DIR, 'nexrev.sqlite3');

function usage() {
  console.log(`NexRev SQLite backup/restore

Usage:
  node backend/scripts/db-backup-restore.mjs backup <output-file>
  node backend/scripts/db-backup-restore.mjs restore <input-file>

Environment overrides:
  DATA_DIR=/path/to/data
  SQLITE_FILE=/path/to/nexrev.sqlite3
`);
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sqlQuote(filePath) {
  return filePath.replace(/'/g, "''");
}

function backup(outFile) {
  const target = path.resolve(outFile);
  ensureParentDir(target);

  const db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
  try {
    db.pragma('busy_timeout = 5000');
    db.exec(`VACUUM INTO '${sqlQuote(target)}'`);
    console.log(`Backup created: ${target}`);
  } finally {
    db.close();
  }
}

function restore(inFile) {
  const source = path.resolve(inFile);
  if (!fs.existsSync(source)) {
    console.error(`Backup file not found: ${source}`);
    process.exit(1);
  }

  ensureParentDir(SQLITE_FILE);

  // Restore is intended to run while the app is stopped.
  fs.copyFileSync(source, SQLITE_FILE);
  const wal = `${SQLITE_FILE}-wal`;
  const shm = `${SQLITE_FILE}-shm`;
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);

  console.log(`Database restored to: ${SQLITE_FILE}`);
}

const [, , command, fileArg] = process.argv;

if (!command || !fileArg) {
  usage();
  process.exit(1);
}

if (command === 'backup') {
  backup(fileArg);
} else if (command === 'restore') {
  restore(fileArg);
} else {
  usage();
  process.exit(1);
}
