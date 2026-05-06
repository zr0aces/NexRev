import React, { useState } from 'react';
import { AlertCircle, Clock, Calendar, CheckCircle2, Inbox, LayoutDashboard, Search } from 'lucide-react';
import type { Opportunity } from '../types';
import MetricsRow from './MetricsRow';
import Badge from './Badge';
import { todayStr, fmtDate, daysUntil } from '../utils';

interface Props {
  opps: Opportunity[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
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

export default function TodayPanel({ opps, onSelect, onEdit }: Props) {
  const [search, setSearch] = useState('');

  let pending = opps
    .filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');

  if (search) {
    const q = search.toLowerCase();
    pending = pending.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.contact ?? '').toLowerCase().includes(q) ||
      (o.notes ?? '').toLowerCase().includes(q)
    );
  }

  pending.sort((a, b) => {
    const pa = urgencyInfo(a).priority;
    const pb = urgencyInfo(b).priority;
    if (pa !== pb) return pa - pb;
    return (a.followup ?? '').localeCompare(b.followup ?? '');
  });

  return (
    <div>
      <MetricsRow opps={opps} />

      <div className="today-grid-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div className="section-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={16} /> All Active Opportunities
          </div>
          
          <div className="today-legend" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.4px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} /> Overdue
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.4px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber-mid)' }} /> Due Soon
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.4px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-tertiary)' }} /> Later
            </div>
          </div>
        </div>

        <div className="pipeline-toolbar" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              className="search-bar"
              type="text"
              placeholder="Search accounts or contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 38, width: '100%' }}
            />
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Inbox size={48} /></div>
            <div>{search ? 'No opportunities match your search' : 'No pending actions. Add opportunities to get started.'}</div>
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
