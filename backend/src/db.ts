import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { KanbanColumn, Opportunity, Stage } from './types.js';

const STAGES: Stage[] = [
  'Prospecting',
  'Qualification',
  'Discovery',
  'Demo',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

const KANBAN_COLUMNS: KanbanColumn[] = ['todo', 'followup', 'done'];

const DATA_DIR_DEFAULT = path.join(process.cwd(), 'data');
export const DATA_DIR = process.env.DATA_DIR ?? DATA_DIR_DEFAULT;
export const SQLITE_FILE =
  process.env.SQLITE_FILE ?? path.join(DATA_DIR, 'nexrev.sqlite3');
const LEGACY_SECRETS_FILE =
  process.env.SECRETS_FILE ?? path.join(DATA_DIR, 'secrets.yaml');

let conn: Database.Database | null = null;
const SCHEMA_VERSION = 1;

interface MigrationOptions {
  onlyWhenEmpty?: boolean;
}

export interface LegacyMigrationResult {
  opportunitiesImported: number;
  usersImported: number;
}

export interface DatabaseInitResult {
  schemaVersion: number;
  legacyMigration: LegacyMigrationResult;
}

function normalizeDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value);
}

function normalizeStage(value: unknown): Stage {
  const candidate = String(value ?? 'Prospecting') as Stage;
  return STAGES.includes(candidate) ? candidate : 'Prospecting';
}

function normalizeColumn(value: unknown, done: boolean): KanbanColumn {
  const candidate = String(value ?? (done ? 'done' : 'todo')) as KanbanColumn;
  return KANBAN_COLUMNS.includes(candidate) ? candidate : (done ? 'done' : 'todo');
}

interface LegacyUser {
  username: string;
  password_hash: string;
  telegram_chat_id?: string;
}

interface LegacySecrets {
  users?: LegacyUser[];
}

function parseLegacyOpportunity(id: string, raw: string): Opportunity {
  const { data, content: body } = matter(raw);
  return {
    id: String(data.id ?? id),
    name: String(data.name ?? ''),
    contact: String(data.contact ?? ''),
    contactEmail: String(data.contactEmail ?? ''),
    contactMobile: String(data.contactMobile ?? ''),
    contactTitle: String(data.contactTitle ?? ''),
    value: data.value != null ? Number(data.value) : null,
    stage: normalizeStage(data.stage),
    close: normalizeDate(data.close),
    followup: normalizeDate(data.followup),
    nextStep: String(data.nextStep ?? ''),
    notes: body.trim(),
    nextSteps: ((data.nextSteps ?? []) as Opportunity['nextSteps']).map((s) => ({
      text: String(s.text ?? ''),
      done: Boolean(s.done),
      column: normalizeColumn(s.column, Boolean(s.done)),
    })),
    activities: ((data.activities ?? []) as Opportunity['activities']).map((a) => ({
      date: normalizeDate(a.date),
      raw: String(a.raw ?? ''),
      summary: a.summary ? String(a.summary) : undefined,
      ai: Boolean(a.ai),
      sf: a.sf ? true : undefined,
    })),
    createdAt: normalizeDate(data.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(data.updatedAt) || new Date().toISOString(),
  };
}

function createSchema(db: Database.Database): void {
  const stages = STAGES.map((stage) => `'${stage.replace(/'/g, "''")}'`).join(', ');

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      telegram_chat_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_mobile TEXT NOT NULL DEFAULT '',
      contact_title TEXT NOT NULL DEFAULT '',
      value REAL,
      stage TEXT NOT NULL CHECK(stage IN (${stages})),
      close_date TEXT NOT NULL DEFAULT '',
      followup_date TEXT NOT NULL DEFAULT '',
      next_step TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS next_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      column_name TEXT NOT NULL CHECK(column_name IN ('todo', 'followup', 'done')),
      done INTEGER NOT NULL CHECK(done IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
      UNIQUE(opportunity_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id TEXT NOT NULL,
      activity_date TEXT NOT NULL,
      raw TEXT NOT NULL,
      summary TEXT,
      ai INTEGER NOT NULL CHECK(ai IN (0, 1)),
      sf INTEGER NOT NULL CHECK(sf IN (0, 1)) DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id
      ON users(telegram_chat_id);

    CREATE INDEX IF NOT EXISTS idx_opportunities_stage
      ON opportunities(stage);

    CREATE INDEX IF NOT EXISTS idx_opportunities_followup_date
      ON opportunities(followup_date);

    CREATE INDEX IF NOT EXISTS idx_opportunities_updated_at
      ON opportunities(updated_at);

    CREATE INDEX IF NOT EXISTS idx_opportunities_name
      ON opportunities(name);

    CREATE INDEX IF NOT EXISTS idx_next_steps_opp_sort
      ON next_steps(opportunity_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_next_steps_opp_column_done
      ON next_steps(opportunity_id, column_name, done);

    CREATE INDEX IF NOT EXISTS idx_activities_opp_date
      ON activities(opportunity_id, activity_date);

    CREATE INDEX IF NOT EXISTS idx_activities_created_at
      ON activities(created_at);
  `);
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare(`
    INSERT INTO app_meta (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(version));
}

function getStoredSchemaVersion(db: Database.Database): number {
  const row = db
    .prepare(`SELECT value FROM app_meta WHERE key = 'schema_version'`)
    .get() as { value: string } | undefined;
  if (!row) return 0;
  const parsed = Number.parseInt(row.value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function insertOpportunityFromLegacy(db: Database.Database, opp: Opportunity): boolean {
  const insertOpp = db.prepare(`
    INSERT INTO opportunities (
      id, name, contact, contact_email, contact_mobile, contact_title,
      value, stage, close_date, followup_date, next_step, notes, created_at, updated_at
    ) VALUES (
      @id, @name, @contact, @contactEmail, @contactMobile, @contactTitle,
      @value, @stage, @close, @followup, @nextStep, @notes, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO NOTHING
  `);

  const insertStep = db.prepare(`
    INSERT INTO next_steps (
      opportunity_id, sort_order, text, column_name, done, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActivity = db.prepare(`
    INSERT INTO activities (
      opportunity_id, activity_date, raw, summary, ai, sf, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((value: Opportunity) => {
    const oppResult = insertOpp.run(value);
    if (oppResult.changes === 0) return false;

    value.nextSteps.forEach((step, index) => {
      const column = normalizeColumn(step.column, Boolean(step.done));
      insertStep.run(
        value.id,
        index,
        step.text,
        column,
        column === 'done' ? 1 : 0,
        value.createdAt,
        value.updatedAt
      );
    });

    value.activities.forEach((activity) => {
      insertActivity.run(
        value.id,
        activity.date || value.createdAt,
        activity.raw,
        activity.summary ?? null,
        activity.ai ? 1 : 0,
        activity.sf ? 1 : 0,
        value.updatedAt
      );
    });

    return true;
  });

  return transaction(opp);
}

async function migrateLegacyOpportunities(
  db: Database.Database,
  options: MigrationOptions = {}
): Promise<number> {
  const onlyWhenEmpty = options.onlyWhenEmpty ?? true;
  const existingCount = db
    .prepare('SELECT COUNT(1) AS count FROM opportunities')
    .get() as { count: number };
  if (onlyWhenEmpty && existingCount.count > 0) return 0;

  const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
  const mdFiles = files.filter((file) => file.endsWith('.md'));
  if (!mdFiles.length) return 0;

  let imported = 0;

  for (const file of mdFiles) {
    try {
      const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
      const parsed = parseLegacyOpportunity(path.basename(file, '.md'), content);
      if (insertOpportunityFromLegacy(db, parsed)) imported += 1;
    } catch (err) {
      console.warn(`Skipping legacy opportunity file ${file}:`, err);
    }
  }

  return imported;
}

async function migrateLegacyUsers(
  db: Database.Database,
  options: MigrationOptions = {}
): Promise<number> {
  const onlyWhenEmpty = options.onlyWhenEmpty ?? true;
  const existingCount = db
    .prepare('SELECT COUNT(1) AS count FROM users')
    .get() as { count: number };
  if (onlyWhenEmpty && existingCount.count > 0) return 0;

  const content = await fs.readFile(LEGACY_SECRETS_FILE, 'utf8').catch(() => null);
  if (!content) return 0;

  try {
    const parsed = (yaml.load(content) as LegacySecrets) ?? {};
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    if (!users.length) return 0;

    const now = new Date().toISOString();
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, telegram_chat_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `);

    const transaction = db.transaction((items: LegacyUser[]) => {
      let imported = 0;
      for (const user of items) {
        if (!user.username || !user.password_hash) continue;
        const result = insertUser.run(
          user.username,
          user.password_hash,
          user.telegram_chat_id ?? null,
          now,
          now
        );
        if (result.changes > 0) imported += 1;
      }
      return imported;
    });

    return transaction(users);
  } catch (err) {
    console.warn('Failed to migrate legacy secrets.yaml:', err);
    return 0;
  }
}

export async function migrateLegacyData(
  options: MigrationOptions = {}
): Promise<LegacyMigrationResult> {
  const db = getDb();
  const opportunitiesImported = await migrateLegacyOpportunities(db, options);
  const usersImported = await migrateLegacyUsers(db, options);
  return { opportunitiesImported, usersImported };
}

export async function initDatabase(): Promise<DatabaseInitResult> {
  if (conn) {
    return {
      schemaVersion: getStoredSchemaVersion(conn),
      legacyMigration: { opportunitiesImported: 0, usersImported: 0 },
    };
  }

  await fs.mkdir(path.dirname(SQLITE_FILE), { recursive: true });
  conn = new Database(SQLITE_FILE);
  createSchema(conn);
  setSchemaVersion(conn, SCHEMA_VERSION);

  const legacyMigration = await migrateLegacyData();

  return {
    schemaVersion: getStoredSchemaVersion(conn),
    legacyMigration,
  };
}

export function getDb(): Database.Database {
  if (!conn) throw new Error('Database has not been initialized. Call initDatabase() first.');
  return conn;
}

export function closeDatabase(): void {
  if (!conn) return;
  conn.close();
  conn = null;
}
