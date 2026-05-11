import type { Activity, Opportunity } from './types.js';
import { completion } from 'litellm';

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

type AiProvider = 'ollama' | 'openrouter' | 'litellm';

interface AiConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

const DEFAULT_TIMEOUT_MS = 90000;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function ensureModelPrefix(model: string, prefix: string): string {
  return model.startsWith(prefix) ? model : `${prefix}${model}`;
}

function activeProvider(): AiProvider {
  const provider = (process.env.AI_PROVIDER ?? 'ollama').trim().toLowerCase();
  if (provider === 'openrouter' || provider === 'litellm' || provider === 'ollama') return provider;
  return 'ollama';
}

function getAiConfig(): AiConfig {
  const provider = activeProvider();
  if (provider === 'openrouter') {
    const modelRaw = (process.env.OPENROUTER_MODEL ?? process.env.AI_MODEL ?? '').trim();
    return {
      provider,
      baseUrl: normalizeBaseUrl(process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'),
      model: modelRaw,
      apiKey: process.env.OPENROUTER_API_KEY,
    };
  }
  if (provider === 'litellm') {
    const modelRaw = (process.env.LITELLM_MODEL ?? process.env.AI_MODEL ?? '').trim();
    const rawPrefix = (process.env.LITELLM_MODEL_PREFIX ?? '').trim();
    const prefix = rawPrefix ? (rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`) : '';
    return {
      provider,
      baseUrl: normalizeBaseUrl(process.env.LITELLM_BASE_URL ?? 'http://localhost:4000'),
      model: modelRaw ? (prefix ? ensureModelPrefix(modelRaw, prefix) : modelRaw) : '',
      apiKey: process.env.LITELLM_API_KEY,
    };
  }
  const model = (process.env.OLLAMA_MODEL ?? process.env.AI_MODEL ?? 'llama3.2').trim();
  return {
    provider: 'ollama',
    baseUrl: normalizeBaseUrl(process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'),
    model: ensureModelPrefix(model, 'ollama/'),
  };
}

function getAiConfigError(config: AiConfig): string | null {
  if (!config.model) {
    if (config.provider === 'openrouter') return 'OPENROUTER_MODEL (or AI_MODEL) is required.';
    if (config.provider === 'litellm') return 'LITELLM_MODEL (or AI_MODEL) is required.';
    return 'OLLAMA_MODEL (or AI_MODEL) is required.';
  }
  if (config.provider === 'openrouter' && !config.apiKey) {
    return 'OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter.';
  }
  return null;
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

export function isAiConfigured(): boolean {
  return getAiConfigError(getAiConfig()) === null;
}

export async function verifyAiProviderAvailability(): Promise<void> {
  const config = getAiConfig();
  const configError = getAiConfigError(config);
  if (configError) throw new Error(configError);
  if (config.provider !== 'ollama') return;
  const res = await fetch(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Ollama is not reachable at ${config.baseUrl}.`);
}

async function runCompletion(config: AiConfig, system: string, user: string): Promise<{ content?: string | null }> {
  if (config.provider === 'openrouter') {
    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexrev.ai',
          'X-Title': 'NexRev',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error('AI rate limit exceeded. Please wait a few seconds and try again.');
        }
        throw new Error(`OpenRouter error: ${err.error?.message || res.statusText}`);
      }
      const data = await res.json();
      return data.choices[0]?.message ?? {};
    } catch (err) {
      throw err;
    }
  }

  const candidates = [config.model];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const response = await completion({
        model: candidate,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      if (response && typeof response === 'object' && 'choices' in response) {
        return response.choices[0]?.message ?? {};
      }
      throw new Error('Unexpected response format from AI provider');
    } catch (err) {
      lastError = err;
      break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI completion failed');
}

async function chat(system: string, user: string): Promise<string> {
  const config = getAiConfig();
  const configError = getAiConfigError(config);
  if (configError) throw new Error(configError);
  try {
    const message = await runWithTimeout(
      runCompletion(config, system, user),
      DEFAULT_TIMEOUT_MS,
      `AI request timed out after ${Math.floor(DEFAULT_TIMEOUT_MS / 1000)} seconds`,
    );
    const content = message.content;
    if (!content) throw new Error('Empty response from AI provider');
    return content;
  } catch (err) {
    throw err;
  }
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
      'You are a sales assistant. Given recent activities and the current board state, produce a concise one-line next-step update suitable for a Salesforce activity note. Focus on the immediate next action and what happened. Output ONLY the one-line summary, no headers or dates.',
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

    console.log('🤖 Requesting AI digest generation...');
    const result = await chat(prompt, "Please generate the Telegram message.");
    console.log('✨ AI digest generated successfully.');
    return result;
  }
}
