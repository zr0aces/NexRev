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
        <div className="metric-label">Active</div>
        <div className="metric-val">{active.length}</div>
      </div>
      <div className="metric-card metric-card--orange">
        <div className="metric-label">Pipeline Value</div>
        <div className="metric-val metric-val--orange">${(totalVal / 1000).toFixed(0)}k</div>
      </div>
      <div className={`metric-card${overdue > 0 ? ' metric-card--red' : ''}`}>
        <div className="metric-label">Overdue Follow-ups</div>
        <div className={`metric-val${overdue > 0 ? ' metric-val--red' : ''}`}>{overdue}</div>
      </div>
      <div className="metric-card metric-card--green">
        <div className="metric-label">Closed Won</div>
        <div className="metric-val metric-val--green">{won}</div>
      </div>
    </div>
  );
}
