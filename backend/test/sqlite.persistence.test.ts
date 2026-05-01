import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

type DbModule = typeof import('../src/db.js');
type StorageModule = typeof import('../src/storage.js');
type AuthModule = typeof import('../src/auth.js');

let tempDir = '';
let dbModule: DbModule;
let storageModule: StorageModule;
let authModule: AuthModule;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexrev-sqlite-test-'));
  process.env.DATA_DIR = tempDir;
  process.env.SQLITE_FILE = path.join(tempDir, 'test.sqlite3');
  process.env.SECRETS_FILE = path.join(tempDir, 'secrets.yaml');

  dbModule = await import('../src/db.js');
  storageModule = await import('../src/storage.js');
  authModule = await import('../src/auth.js');

  await dbModule.initDatabase();
});

after(async () => {
  dbModule.closeDatabase();
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('creates expected indexes for key query paths', () => {
  const db = dbModule.getDb();
  const indexes = db
    .prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%'
    `)
    .all() as Array<{ name: string }>;

  const names = new Set(indexes.map((idx) => idx.name));
  assert.ok(names.has('idx_users_telegram_chat_id'));
  assert.ok(names.has('idx_opportunities_stage'));
  assert.ok(names.has('idx_opportunities_followup_date'));
  assert.ok(names.has('idx_opportunities_updated_at'));
  assert.ok(names.has('idx_next_steps_opp_sort'));
  assert.ok(names.has('idx_next_steps_opp_column_done'));
  assert.ok(names.has('idx_activities_opp_date'));
});

test('persists and hydrates opportunity aggregates correctly', async () => {
  const now = new Date().toISOString();
  const opp = {
    id: 'opp-test-001',
    name: 'Acme Corp',
    contact: 'Jane Doe',
    contactEmail: 'jane@acme.test',
    contactMobile: '+66123456789',
    contactTitle: 'Director',
    value: 120000,
    stage: 'Discovery' as const,
    close: '2026-08-15',
    followup: '2026-05-02',
    nextStep: 'Schedule technical workshop',
    notes: 'Important account context',
    nextSteps: [
      { text: 'Prepare deck', done: false, column: 'todo' as const },
      { text: 'Call stakeholder', done: false, column: 'followup' as const },
      { text: 'Initial demo complete', done: true, column: 'done' as const },
    ],
    activities: [
      { date: '2026-05-01', raw: 'Kickoff call', summary: 'Positive interest', ai: true },
      { date: '2026-05-01', raw: 'Sent deck', ai: false, sf: true },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await storageModule.writeOpportunity(opp);
  const loaded = await storageModule.readOpportunity(opp.id);

  assert.equal(loaded.id, opp.id);
  assert.equal(loaded.name, 'Acme Corp');
  assert.equal(loaded.nextSteps.length, 3);
  assert.deepEqual(loaded.nextSteps.map((s) => s.column), ['todo', 'followup', 'done']);
  assert.equal(loaded.activities.length, 2);
  assert.equal(loaded.activities[1].sf, true);
});

test('enforces identity uniqueness constraints', async () => {
  const db = dbModule.getDb();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO users (username, password_hash, telegram_chat_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run('alice', 'hash-1', 'chat-1', now, now);

  assert.throws(() => {
    db.prepare(
      'INSERT INTO users (username, password_hash, telegram_chat_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('alice', 'hash-2', 'chat-2', now, now);
  });

  assert.throws(() => {
    db.prepare(
      'INSERT INTO users (username, password_hash, telegram_chat_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('bob', 'hash-3', 'chat-1', now, now);
  });

  // Verify auth module can still read/write through the same datastore.
  const ok = await authModule.verifyCredentials('alice', 'wrong');
  assert.equal(ok, false);
});

test('forced legacy migration imports without duplicating existing aggregates', async () => {
  const legacyOpp = `---\nid: opp-legacy-1\nname: Legacy Inc\nstage: Demo\nnextSteps:\n  - text: Legacy task\n    done: false\n    column: todo\nactivities:\n  - date: 2026-05-01\n    raw: Legacy note\n    ai: true\n---\nlegacy body`;
  await fs.writeFile(path.join(tempDir, 'opp-legacy-1.md'), legacyOpp, 'utf8');

  const legacySecrets = `users:\n  - username: legacy_user\n    password_hash: legacy_hash\n    telegram_chat_id: legacy_chat`;
  await fs.writeFile(path.join(tempDir, 'secrets.yaml'), legacySecrets, 'utf8');

  const first = await dbModule.migrateLegacyData({ onlyWhenEmpty: false });
  assert.equal(first.opportunitiesImported, 1);
  assert.equal(first.usersImported, 1);

  const second = await dbModule.migrateLegacyData({ onlyWhenEmpty: false });
  assert.equal(second.opportunitiesImported, 0);
  assert.equal(second.usersImported, 0);

  const loaded = await storageModule.readOpportunity('opp-legacy-1');
  assert.equal(loaded.nextSteps.length, 1);
  assert.equal(loaded.activities.length, 1);
});
