export type Stage =
  | 'Prospecting' | 'Qualification' | 'Discovery' | 'Demo'
  | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';

export const STAGES: Stage[] = [
  'Prospecting', 'Qualification', 'Discovery', 'Demo',
  'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost',
];

export const STAGE_COLORS: Record<Stage, string> = {
  Prospecting: 'gray',
  Qualification: 'blue',
  Discovery: 'teal',
  Demo: 'blue',
  Proposal: 'amber',
  Negotiation: 'amber',
  'Closed Won': 'green',
  'Closed Lost': 'red',
};

export type KanbanColumn = 'todo' | 'followup' | 'done';

export interface NextStep {
  text: string;
  done: boolean;
}

export interface Activity {
  date: string;
  raw: string;
  summary?: string;
  ai: boolean;
  column: KanbanColumn;
}

export interface Opportunity {
  id: string;
  name: string;
  contact: string;
  contactEmail: string;
  contactMobile: string;
  contactTitle: string;
  value: number | null;
  stage: Stage;
  close: string;
  followup: string;
  nextStep: string;
  notes: string;
  nextSteps: NextStep[];
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
}
