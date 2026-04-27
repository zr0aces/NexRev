import React from 'react';
import type { Opportunity } from '../types';
import { todayStr } from '../utils';

export default function MetricsRow({ opps }: { opps: Opportunity[] }) {
  const active = opps.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');
  const totalVal = active.reduce((s, o) => s + (o.value ?? 0), 0);
  const overdue = active.filter(o => o.followup && o.followup < todayStr()).length;
  const won = opps.filter(o => o.stage === 'Closed Won').length;

  return (
    <div className="metrics-row">
      <div className="metric-card">
        <div className="metric-label">Active opportunities</div>
        <div className="metric-val">{active.length}</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Pipeline value</div>
        <div className="metric-val">${(totalVal / 1000).toFixed(0)}k</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Overdue follow-ups</div>
        <div className="metric-val" style={{ color: overdue > 0 ? 'var(--red)' : undefined }}>{overdue}</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Closed won</div>
        <div className="metric-val" style={{ color: 'var(--teal)' }}>{won}</div>
      </div>
    </div>
  );
}
