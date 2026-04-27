import React from 'react';
import type { Opportunity } from '../types';
import MetricsRow from './MetricsRow';
import Badge from './Badge';
import { todayStr, fmtDate, daysUntil } from '../utils';

interface Props {
  opps: Opportunity[];
  onView: (id: string) => void;
}

export default function TodayPanel({ opps, onView }: Props) {
  const pending = opps
    .filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost' && (o.followup || o.nextStep))
    .sort((a, b) => {
      if (!a.followup && b.followup) return 1;
      if (a.followup && !b.followup) return -1;
      return (a.followup ?? '').localeCompare(b.followup ?? '');
    });

  return (
    <div>
      <MetricsRow opps={opps} />
      <div className="card">
        <div className="section-label">Pending actions &amp; follow-ups</div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#x25A1;</div>
            <div>No pending actions. Add opportunities to get started.</div>
          </div>
        ) : (
          pending.map(o => {
            const d = daysUntil(o.followup);
            let urgency: React.ReactNode = null;
            let dotColor = 'var(--text-tertiary)';
            if (o.followup && d !== null) {
              if (d < 0) {
                urgency = <span className="overdue">Overdue {Math.abs(d)}d</span>;
                dotColor = 'var(--red)';
              } else if (d === 0) {
                urgency = <span className="due-today">Due today</span>;
                dotColor = 'var(--amber-mid)';
              } else if (d <= 3) {
                urgency = <span className="due-soon">In {d}d</span>;
                dotColor = 'var(--amber-mid)';
              } else {
                urgency = <span style={{ color: 'var(--text-tertiary)' }}>In {d}d ({fmtDate(o.followup)})</span>;
              }
            }
            return (
              <div key={o.id} className="digest-item">
                <div className="digest-dot" style={{ background: dotColor }} />
                <div className="digest-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="digest-name">{o.name}</span>
                    <Badge stage={o.stage} />
                    {urgency}
                  </div>
                  {o.nextStep && <div className="digest-sub">Next: {o.nextStep}</div>}
                  {o.contact && <div className="digest-date">{o.contact}</div>}
                </div>
                <button className="btn btn-sm" onClick={() => onView(o.id)}>View</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
