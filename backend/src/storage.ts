import { getDb, initDatabase } from './db.js';
import type { Opportunity, Stage } from './types.js';

interface OpportunityRow {
  id: string;
  name: string;
  contact: string;
  contact_email: string;
  contact_mobile: string;
  contact_title: string;
  value: number | null;
  stage: Stage;
  close_date: string;
  followup_date: string;
  next_step: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface NextStepRow {
  text: string;
  done: number;
  column_name: Opportunity['nextSteps'][number]['column'];
}

interface ActivityRow {
  activity_date: string;
  raw: string;
  summary: string | null;
  ai: number;
  sf: number;
}

function buildOpportunity(
  row: OpportunityRow,
  steps: NextStepRow[],
  activities: ActivityRow[]
): Opportunity {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    contactEmail: row.contact_email,
    contactMobile: row.contact_mobile,
    contactTitle: row.contact_title,
    value: row.value,
    stage: row.stage,
    close: row.close_date,
    followup: row.followup_date,
    nextStep: row.next_step,
    notes: row.notes,
    nextSteps: steps.map((step) => ({
      text: step.text,
      done: Boolean(step.done),
      column: step.column_name,
    })),
    activities: activities.map((activity) => ({
      date: activity.activity_date,
      raw: activity.raw,
      summary: activity.summary ?? undefined,
      ai: Boolean(activity.ai),
      sf: activity.sf ? true : undefined,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hydrateOpportunity(row: OpportunityRow): Opportunity {
  const db = getDb();

  const steps = db
    .prepare(`
      SELECT text, done, column_name
      FROM next_steps
      WHERE opportunity_id = ?
      ORDER BY sort_order ASC
    `)
    .all(row.id) as NextStepRow[];

  const activities = db
    .prepare(`
      SELECT activity_date, raw, summary, ai, sf
      FROM activities
      WHERE opportunity_id = ?
      ORDER BY id ASC
    `)
    .all(row.id) as ActivityRow[];

  return buildOpportunity(row, steps, activities);
}

export async function ensureDataDir(): Promise<void> {
  await initDatabase();
}

export async function listIds(): Promise<Set<string>> {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM opportunities').all() as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT
        id, name, contact, contact_email, contact_mobile, contact_title,
        value, stage, close_date, followup_date, next_step, notes,
        created_at, updated_at
      FROM opportunities
      ORDER BY name COLLATE NOCASE ASC
    `)
    .all() as OpportunityRow[];

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);

  // Batch-fetch all steps and activities to avoid N+1 queries.
  // Chunk IDs to stay within SQLite's per-statement variable limit.
  const CHUNK = 900;
  const allSteps: (NextStepRow & { opportunity_id: string })[] = [];
  const allActivities: (ActivityRow & { opportunity_id: string })[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(', ');

    const steps = db
      .prepare(
        `SELECT opportunity_id, text, done, column_name
         FROM next_steps
         WHERE opportunity_id IN (${ph})
         ORDER BY opportunity_id, sort_order ASC`
      )
      .all(...chunk) as (NextStepRow & { opportunity_id: string })[];
    allSteps.push(...steps);

    const activities = db
      .prepare(
        `SELECT opportunity_id, activity_date, raw, summary, ai, sf
         FROM activities
         WHERE opportunity_id IN (${ph})
         ORDER BY opportunity_id, id ASC`
      )
      .all(...chunk) as (ActivityRow & { opportunity_id: string })[];
    allActivities.push(...activities);
  }

  const stepsMap = new Map<string, NextStepRow[]>();
  for (const step of allSteps) {
    const arr = stepsMap.get(step.opportunity_id);
    if (arr) arr.push(step);
    else stepsMap.set(step.opportunity_id, [step]);
  }

  const activitiesMap = new Map<string, ActivityRow[]>();
  for (const act of allActivities) {
    const arr = activitiesMap.get(act.opportunity_id);
    if (arr) arr.push(act);
    else activitiesMap.set(act.opportunity_id, [act]);
  }

  return rows.map((row) =>
    buildOpportunity(row, stepsMap.get(row.id) ?? [], activitiesMap.get(row.id) ?? [])
  );
}

export async function readOpportunity(id: string): Promise<Opportunity> {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT
        id, name, contact, contact_email, contact_mobile, contact_title,
        value, stage, close_date, followup_date, next_step, notes,
        created_at, updated_at
      FROM opportunities
      WHERE id = ?
    `)
    .get(id) as OpportunityRow | undefined;

  if (!row) throw new Error('Opportunity not found');
  return hydrateOpportunity(row);
}

export async function writeOpportunity(opp: Opportunity): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const updated: Opportunity = { ...opp, updatedAt: now };

  const upsertOpportunity = db.prepare(`
    INSERT INTO opportunities (
      id, name, contact, contact_email, contact_mobile, contact_title,
      value, stage, close_date, followup_date, next_step, notes,
      created_at, updated_at
    ) VALUES (
      @id, @name, @contact, @contactEmail, @contactMobile, @contactTitle,
      @value, @stage, @close, @followup, @nextStep, @notes,
      @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      contact = excluded.contact,
      contact_email = excluded.contact_email,
      contact_mobile = excluded.contact_mobile,
      contact_title = excluded.contact_title,
      value = excluded.value,
      stage = excluded.stage,
      close_date = excluded.close_date,
      followup_date = excluded.followup_date,
      next_step = excluded.next_step,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);

  const deleteSteps = db.prepare('DELETE FROM next_steps WHERE opportunity_id = ?');
  const insertStep = db.prepare(`
    INSERT INTO next_steps (
      opportunity_id, sort_order, text, column_name, done, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteActivities = db.prepare('DELETE FROM activities WHERE opportunity_id = ?');
  const insertActivity = db.prepare(`
    INSERT INTO activities (
      opportunity_id, activity_date, raw, summary, ai, sf, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((value: Opportunity) => {
    upsertOpportunity.run(value);

    deleteSteps.run(value.id);
    value.nextSteps.forEach((step, index) => {
      const done = step.column === 'done' ? 1 : 0;
      insertStep.run(
        value.id,
        index,
        step.text,
        step.column,
        done,
        value.createdAt,
        value.updatedAt
      );
    });

    deleteActivities.run(value.id);
    value.activities.forEach((activity) => {
      insertActivity.run(
        value.id,
        activity.date,
        activity.raw,
        activity.summary ?? null,
        activity.ai ? 1 : 0,
        activity.sf ? 1 : 0,
        value.updatedAt
      );
    });
  });

  tx(updated);
}

export async function deleteOpportunity(id: string): Promise<void> {
  const db = getDb();
  const result = db.prepare('DELETE FROM opportunities WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error('Opportunity not found');
  }
}
