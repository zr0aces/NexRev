import React from 'react';
import { History, Sparkles, Inbox, MessageSquare } from 'lucide-react';
import type { Opportunity } from '../types';

interface Props {
  opps: Opportunity[];
}

export default function ActivityLogPanel({ opps }: Props) {
  const all: Array<{ date: string; raw: string; summary?: string; ai: boolean; oppName: string; oppId: string; sf?: boolean }> = [];
  opps.forEach(o =>
    (o.activities ?? []).forEach(a => all.push({ ...a, oppName: o.name, oppId: o.id }))
  );
  all.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="card">
      <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <History size={16} /> All activity — newest first
      </div>
      {all.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Inbox size={48} /></div>
          <div>No activities logged yet</div>
        </div>
      ) : (
        all.map((a, i) => (
          <div key={`${a.oppId}-${a.date}-${i}`} className="activity-item">
            <div className="activity-meta">
              <span className="activity-opp" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={12} /> {a.oppName}
              </span>
              {a.ai && (
                <span className="badge badge-ai" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <Sparkles size={10} /> AI
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{a.summary ?? a.raw}</div>
            <div className="activity-date">{a.date}</div>
          </div>
        ))
      )}
    </div>
  );
}
