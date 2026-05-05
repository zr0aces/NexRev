import type { Activity, Opportunity } from './types.js';

export interface ActivityContext {
  indices?: number[];
  drafts?: Activity[];
}

export interface ExtractedTasks {
  todo: string[];
  followup: string[];
  done: string[];
}

export class NoActivitiesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoActivitiesError';
  }
}

const baseUrl = () => (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const model   = () => process.env.OLLAMA_MODEL ?? 'llama3.2';

async function chat(system: string, user: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model(),
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  const data = await res.json() as { message?: { content?: string }; error?: string };
  if (data.error) throw new Error(`Ollama: ${data.error}`);
  const content = data.message?.content;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
}

function formatKanban(opp: Opportunity): string {
  const groups = {
    todo:     opp.nextSteps.filter(s => s.column === 'todo').map(s => s.text),
    followup: opp.nextSteps.filter(s => s.column === 'followup').map(s => s.text),
    done:     opp.nextSteps.filter(s => s.column === 'done').map(s => s.text),
  };
  const fmt = (items: string[]) => items.length ? items.map(t => `  • ${t}`).join('\n') : '  (none)';
  return [
    'Current board state for this account:',
    `To Do:\n${fmt(groups.todo)}`,
    `Follow-ups pending:\n${fmt(groups.followup)}`,
    `Completed:\n${fmt(groups.done)}`,
  ].join('\n');
}

function resolveActivities(opp: Opportunity, context?: ActivityContext): Activity[] {
  if (!context) {
    const lastSfIdx = opp.activities.reduce((acc, a, i) => (a.sf ? i : acc), -1);
    const sinceLastSf = lastSfIdx >= 0 ? opp.activities.slice(lastSfIdx + 1) : opp.activities;
    return sinceLastSf.filter(a => !a.sf);
  }
  let selected: Activity[] = context.indices
    ? context.indices.map(i => opp.activities[i]).filter((a): a is Activity => a != null)
    : [...opp.activities];
  if (context.drafts?.length) selected = [...selected, ...context.drafts];
  return selected;
}

export class AiService {
  async summarize(raw: string, opp: Opportunity): Promise<string> {
    const kanbanSection = opp.nextSteps.length ? `\n\n---\n${formatKanban(opp)}` : '';
    return chat(
      'You are a sales assistant. Given raw meeting or call notes (and optionally the current task board state), produce a concise structured summary with: 1) Key discussion points (2-3 bullets) 2) Decisions made 3) Action items — flag any board items that were discussed or resolved. Keep it under 150 words. Plain text, no markdown headers, use dashes for bullets.',
      raw + kanbanSection,
    );
  }

  async buildSfNote(opp: Opportunity, context?: ActivityContext): Promise<string> {
    const activities = resolveActivities(opp, context);
    if (!activities.length) throw new NoActivitiesError('No new activities since the last SF note.');
    const recentActs = activities.map(a => a.summary ?? a.raw).join('\n---\n');
    const kanbanSection = opp.nextSteps.length ? `\n${formatKanban(opp)}` : '';
    return chat(
      'You are a Salesforce CRM assistant. Given recent sales activity notes and the current task board, produce a Salesforce activity note in this exact format:\nDATE: [date]\nACTIVITY TYPE: [Call/Meeting/Email]\nSUMMARY: [1-2 sentences]\nNEXT STEP: [specific action, with date if known]\n\nUnder 80 words. Professional. CRM-ready.',
      `Account: ${opp.name}\nStage: ${opp.stage}\nContact: ${opp.contact || 'N/A'}\nRecent activities:\n${recentActs}\nNext step on file: ${opp.nextStep || 'None'}${kanbanSection}`,
    );
  }

  async extractTasks(opp: Opportunity, context?: ActivityContext): Promise<ExtractedTasks> {
    const activities = resolveActivities(opp, context);
    if (!activities.length) throw new NoActivitiesError('No new activities to extract tasks from.');
    const activityText = activities.map(a => a.summary ?? a.raw).join('\n---\n');
    const prompt = `You are a sales assistant. Given recent sales activity notes, extract a list of specific action items or tasks for a Kanban board.
Organize them into:
1) "todo" (tasks yet to be started)
2) "followup" (actions pending external response or specific follow-up dates)
3) "done" (tasks mentioned as completed)

Return ONLY a JSON object in this exact format:
{
  "todo": ["task 1", "task 2"],
  "followup": ["task 3"],
  "done": ["task 4"]
}
If no tasks are found for a category, return an empty array. No other text.`;

    const result = await chat(prompt, activityText);
    try {
      const match = result.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : result) as ExtractedTasks;
    } catch (e) {
      throw new Error('Failed to parse AI task extraction result: ' + (e as Error).message);
    }
  }

  async generateDailyDigest(data: {
    dueToday: Opportunity[];
    overdue: Opportunity[];
    upcomingWeek: Opportunity[];
  }): Promise<string> {
    const sections: string[] = [];

    if (data.dueToday.length > 0) {
      sections.push("DUE TODAY:\n" + data.dueToday.map(o => {
        let text = `- ${o.name} (${o.stage})`;
        if (o.nextStep) text += `\n  Next: ${o.nextStep}`;
        const pending = o.nextSteps.filter(s => !s.done).map(s => s.text);
        if (pending.length > 0) text += `\n  Tasks: ${pending.join(', ')}`;
        return text;
      }).join('\n'));
    }

    if (data.overdue.length > 0) {
      sections.push("OVERDUE:\n" + data.overdue.map(o => `- ${o.name} (Due: ${o.followup})`).join('\n'));
    }

    if (data.upcomingWeek.length > 0) {
      sections.push("UPCOMING THIS WEEK:\n" + data.upcomingWeek.map(o => `- ${o.name} (Due: ${o.followup})`).join('\n'));
    }

    if (sections.length === 0) return "No activities planned for today or this week. Have a great day!";

    const context = sections.join('\n\n');
    const prompt = `You are a sales operations assistant. Create a professional, encouraging daily digest for a sales team.
The digest should be formatted in HTML for Telegram (using <b>, <i> tags).
Include:
1) A brief greeting (e.g. 🌅 NexRev Daily Digest).
2) A clear summary of "Activities for Today" (including overdue items).
3) An overview of "Planned for the Week".

Keep it concise, actionable, and visually organized with emojis. Use <b> for headings.
Use bullet points for items.

Data:
${context}`;

    return chat(prompt, "Please generate the Telegram message.");
  }
}
