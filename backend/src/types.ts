export type Stage =
  | 'Prospecting' | 'Qualification' | 'Discovery' | 'Demo'
  | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';

export type KanbanColumn = 'todo' | 'followup' | 'done';

export interface NextStep {
  text: string;
  done: boolean;
  column: KanbanColumn;
}

export interface Activity {
  date: string;
  raw: string;
  summary?: string;
  ai: boolean;
}

export interface KanbanContext {
  todo: string[];
  followup: string[];
  done: string[];
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
