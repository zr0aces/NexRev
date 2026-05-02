import { nanoid } from 'nanoid';
import * as storage from './storage.js';
import type { Activity, KanbanColumn, Opportunity } from './types.js';

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Opportunity not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export interface ActivityInput {
  raw: string;
  summary?: string;
  ai: boolean;
  sf?: boolean;
}

export interface StepPatch {
  text?: string;
  column?: KanbanColumn;
  done?: boolean;
}

export interface BulkImportResult {
  created: Opportunity[];
  skipped: { item: unknown; reason: string }[];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function syncStep(
  step: Opportunity['nextSteps'][number],
  patch: StepPatch
): Opportunity['nextSteps'][number] {
  const updated = { ...step };
  if (patch.text !== undefined) updated.text = patch.text;
  if (patch.column !== undefined) {
    updated.column = patch.column;
    updated.done = patch.column === 'done';
  } else if (patch.done !== undefined) {
    updated.done = patch.done;
    updated.column = patch.done ? 'done' : (updated.column === 'done' ? 'todo' : updated.column);
  }
  return updated;
}

async function read(id: string): Promise<Opportunity> {
  try {
    return await storage.readOpportunity(id);
  } catch {
    throw new NotFoundError(id);
  }
}

export class OpportunityStore {
  list(): Promise<Opportunity[]> {
    return storage.listOpportunities();
  }

  async get(id: string): Promise<Opportunity> {
    return read(id);
  }

  async create(
    draft: Omit<Opportunity, 'id' | 'activities' | 'nextSteps' | 'createdAt' | 'updatedAt'>
  ): Promise<Opportunity> {
    const now = new Date().toISOString();
    const opp: Opportunity = {
      ...draft,
      id: nanoid(10),
      activities: [],
      nextSteps: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.writeOpportunity(opp);
    return opp;
  }

  async patch(id: string, fields: Partial<Opportunity>): Promise<Opportunity> {
    const existing = await read(id);
    // Strip fields that must not be overwritten via patch
    const { id: _id, activities: _activities, nextSteps: _nextSteps, createdAt: _createdAt, updatedAt: _updatedAt, ...safe } = fields;
    const updated: Opportunity = { ...existing, ...safe, id: existing.id };
    await storage.writeOpportunity(updated);
    return read(id);
  }

  async addActivity(id: string, input: ActivityInput): Promise<Opportunity> {
    const opp = await read(id);
    const activity: Activity = {
      date: today(),
      raw: input.raw,
      summary: input.summary,
      ai: input.ai,
      sf: input.sf,
    };
    opp.activities.push(activity);
    await storage.writeOpportunity(opp);
    return read(id);
  }

  async upsertStep(id: string, index: number | null, patch: StepPatch): Promise<Opportunity> {
    const opp = await read(id);
    if (index === null) {
      const col: KanbanColumn = patch.column ?? 'todo';
      opp.nextSteps.push({ text: patch.text ?? '', done: col === 'done', column: col });
    } else {
      if (index < 0 || index >= opp.nextSteps.length) throw new NotFoundError(`step:${index}`);
      opp.nextSteps[index] = syncStep(opp.nextSteps[index], patch);
    }
    await storage.writeOpportunity(opp);
    return read(id);
  }

  async removeStep(id: string, index: number): Promise<Opportunity> {
    const opp = await read(id);
    if (index < 0 || index >= opp.nextSteps.length) throw new NotFoundError(`step:${index}`);
    opp.nextSteps.splice(index, 1);
    await storage.writeOpportunity(opp);
    return read(id);
  }

  async delete(id: string): Promise<void> {
    try {
      await storage.deleteOpportunity(id);
    } catch {
      throw new NotFoundError(id);
    }
  }

  async bulkImport(items: unknown[]): Promise<BulkImportResult> {
    const existingIds = await storage.listIds();
    const now = new Date().toISOString();
    const created: Opportunity[] = [];
    const skipped: BulkImportResult['skipped'] = [];

    for (const item of items) {
      try {
        const raw = item as Record<string, unknown>;
        if (!raw.name || typeof raw.name !== 'string' || !raw.name.trim()) {
          skipped.push({ item, reason: 'missing name' });
          continue;
        }
        const id = typeof raw.id === 'string' && raw.id ? raw.id : nanoid(10);
        if (existingIds.has(id)) {
          skipped.push({ item, reason: 'id already exists' });
          continue;
        }
        const col = (s: Record<string, unknown>): KanbanColumn =>
          (s.column as KanbanColumn) ?? (s.done ? 'done' : 'todo');
        const opp: Opportunity = {
          id,
          name: raw.name,
          contact: typeof raw.contact === 'string' ? raw.contact : '',
          contactEmail: typeof raw.contactEmail === 'string' ? raw.contactEmail : '',
          contactMobile: typeof raw.contactMobile === 'string' ? raw.contactMobile : '',
          contactTitle: typeof raw.contactTitle === 'string' ? raw.contactTitle : '',
          value: typeof raw.value === 'number' ? raw.value : null,
          stage: (raw.stage as Opportunity['stage']) ?? 'Prospecting',
          close: typeof raw.close === 'string' ? raw.close : '',
          followup: typeof raw.followup === 'string' ? raw.followup : '',
          nextStep: typeof raw.nextStep === 'string' ? raw.nextStep : '',
          notes: typeof raw.notes === 'string' ? raw.notes : '',
          nextSteps: Array.isArray(raw.nextSteps)
            ? (raw.nextSteps as Record<string, unknown>[]).map(s => ({
                text: typeof s.text === 'string' ? s.text : '',
                done: Boolean(s.done),
                column: col(s),
              }))
            : [],
          activities: Array.isArray(raw.activities)
            ? (raw.activities as Record<string, unknown>[]).map(a => ({
                date: typeof a.date === 'string' ? a.date : today(),
                raw: typeof a.raw === 'string' ? a.raw : '',
                summary: typeof a.summary === 'string' ? a.summary : undefined,
                ai: Boolean(a.ai),
                sf: a.sf ? true : undefined,
              }))
            : [],
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
        };
        await storage.writeOpportunity(opp);
        existingIds.add(id);
        created.push(opp);
      } catch (err) {
        skipped.push({ item, reason: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    return { created, skipped };
  }
}
