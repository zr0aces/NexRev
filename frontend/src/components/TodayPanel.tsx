import React from 'react';
import { AlertCircle, Clock, Calendar, CheckCircle2, Inbox } from 'lucide-react';
import type { Opportunity } from '../types';
import MetricsRow from './MetricsRow';
import Badge from './Badge';
import { todayStr, fmtDate, daysUntil } from '../utils';

interface Props {
  opps: Opportunity[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdate: (opp: Opportunity) => void;
  onRemove: (id: string) => void;
}

function urgencyInfo(o: Opportunity): { label: React.ReactNode; icon: React.ReactNode; dotColor: string; priority: number } {
  const d = daysUntil(o.followup);
  if (o.followup && d !== null) {
    if (d < 0) return {
      label: <span className="overdue">Overdue {Math.abs(d)}d</span>,
      icon: <AlertCircle size={14} className="overdue" />,
      dotColor: 'var(--red)',
      priority: 0,
    };
    if (d === 0) return {
      label: <span className="due-today">Due today</span>,
      icon: <Clock size={14} className="due-today" />,
      dotColor: 'var(--amber-mid)',
      priority: 1,
    };
    if (d <= 3) return {
      label: <span className="due-soon">In {d}d</span>,
      icon: <Calendar size={14} className="due-soon" />,
      dotColor: 'var(--amber-mid)',
      priority: 2,
    };
    return {
      label: <span style={{ color: 'var(--text-tertiary)' }}>In {d}d ({fmtDate(o.followup)})</span>,
      icon: <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />,
      dotColor: 'var(--text-tertiary)',
      priority: 3,
    };
  }
  return { label: null, icon: null, dotColor: 'var(--text-tertiary)', priority: 4 };
}

export default function TodayPanel({ opps, onSelect, onEdit, onUpdate, onRemove }: Props) {
  const pending = opps
    .filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost' && (o.followup || o.nextStep))
    .sort((a, b) => {
      const pa = urgencyInfo(a).priority;
      const pb = urgencyInfo(b).priority;
      if (pa !== pb) return pa - pb;
      return (a.followup ?? '').localeCompare(b.followup ?? '');
    });

  return (
    <div>
      <MetricsRow opps={opps} />

      <div className="today-grid-wrapper">
        <div className="section-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} /> Pending actions &amp; follow-ups
        </div>

        {pending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Inbox size={48} /></div>
            <div>No pending actions. Add opportunities to get started.</div>
          </div>
        ) : (
          <div className="today-grid">
            {pending.map(o => {
              const { label, icon, dotColor } = urgencyInfo(o);
              return (
                <div
                  key={o.id}
                  className="today-card"
                  onClick={() => onSelect(o.id)}
                >
                  <div className="today-card-top">
                    <div className="today-card-dot" style={{ background: dotColor }} />
                    <Badge stage={o.stage} />
                  </div>
                  <div className="today-card-body">
                    <div className="today-card-name">{o.name}</div>
                    {o.contact && <div className="today-card-contact">{o.contact}</div>}
                    {label && (
                      <div className="today-card-urgency" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {icon} {label}
                      </div>
                    )}
                  </div>
                  {o.nextStep && (
                    <div className="today-card-footer">
                      <div className="today-card-next" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={12} /> Next: {o.nextStep}
                      </div>
                    </div>
                  )}
                  <div className="today-card-accent" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
