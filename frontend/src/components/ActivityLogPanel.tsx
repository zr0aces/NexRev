import React from 'react';
import type { Opportunity } from '../types';

interface Props {
  opps: Opportunity[];
}

export default function ActivityLogPanel({ opps }: Props) {
  const all: Array<{ date: string; raw: string; summary?: string; ai: boolean; oppName: string; oppId: string }> = [];
  opps.forEach(o =>
    (o.activities ?? []).forEach(a => all.push({ ...a, oppName: o.name, oppId: o.id }))
  );
  all.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="card">
      <div className="section-label">All activity — newest first</div>
      {all.length === 0 ? (
        <div className="empty-state">No activities logged yet</div>
      ) : (
        all.map((a, i) => (
          <div key={i} className="activity-item">
            <div className="activity-meta">
              <span className="activity-opp">{a.oppName}</span>
              {a.ai && <span className="badge badge-ai" style={{ fontSize: 10 }}>AI</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{a.summary ?? a.raw}</div>
            <div className="activity-date">{a.date}</div>
          </div>
        ))
      )}
    </div>
  );
}
