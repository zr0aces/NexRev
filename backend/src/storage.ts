import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import type { Opportunity } from './types.js';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');

export async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function normalizeDate(d: unknown): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d);
}

function parseOpp(id: string, raw: string): Opportunity {
  const { data, content: body } = matter(raw);
  return {
    id: String(data.id ?? id),
    name: String(data.name ?? ''),
    contact: String(data.contact ?? ''),
    contactEmail: String(data.contactEmail ?? ''),
    contactMobile: String(data.contactMobile ?? ''),
    contactTitle: String(data.contactTitle ?? ''),
    value: data.value != null ? Number(data.value) : null,
    stage: data.stage ?? 'Prospecting',
    close: normalizeDate(data.close),
    followup: normalizeDate(data.followup),
    nextStep: String(data.nextStep ?? ''),
    notes: body.trim(),
    nextSteps: ((data.nextSteps ?? []) as Opportunity['nextSteps']).map(s => ({
      text: String(s.text ?? ''),
      done: Boolean(s.done),
      column: (s.column ?? (s.done ? 'done' : 'todo')) as Opportunity['nextSteps'][number]['column'],
    })),
    activities: ((data.activities ?? []) as Opportunity['activities']).map(a => ({
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

export async function listIds(): Promise<Set<string>> {
  const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
  return new Set(files.filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)));
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  if (!mdFiles.length) return [];
  const opps = await Promise.all(
    mdFiles.map(async f => {
      const content = await fs.readFile(path.join(DATA_DIR, f), 'utf8');
      return parseOpp(path.basename(f, '.md'), content);
    })
  );
  return opps.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readOpportunity(id: string): Promise<Opportunity> {
  const content = await fs.readFile(path.join(DATA_DIR, `${id}.md`), 'utf8');
  return parseOpp(id, content);
}

export async function writeOpportunity(opp: Opportunity): Promise<void> {
  const { notes, ...frontmatter } = opp;
  frontmatter.updatedAt = new Date().toISOString();
  // js-yaml (used by gray-matter) throws on `undefined` values — strip them via JSON round-trip
  const clean = JSON.parse(JSON.stringify(frontmatter)) as typeof frontmatter;
  const content = matter.stringify(notes ?? '', clean);
  await fs.writeFile(path.join(DATA_DIR, `${opp.id}.md`), content);
}

export async function deleteOpportunity(id: string): Promise<void> {
  await fs.unlink(path.join(DATA_DIR, `${id}.md`));
}
