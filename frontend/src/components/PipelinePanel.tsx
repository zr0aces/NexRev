import React, { useState } from 'react';
import type { Opportunity } from '../types';
import { STAGES } from '../types';
import Badge from './Badge';
import DetailPanel from './DetailPanel';
import { todayStr, fmtDate } from '../utils';

interface Props {
  opps: Opportunity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string) => void;
  onUpdate: (opp: Opportunity) => void;
  onRemove: (id: string) => void;
}

export default function PipelinePanel({ opps, selectedId, onSelect, onEdit, onUpdate, onRemove }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [stageFilter, setStageFilter] = useState('All');

  let list = [...opps];
  if (stageFilter !== 'All') list = list.filter(o => o.stage === stageFilter);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.contact ?? '').toLowerCase().includes(q) ||
      (o.notes ?? '').toLowerCase().includes(q)
    );
  }
  if (sort === 'value') list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  else if (sort === 'due') list.sort((a, b) => (a.followup || '9999').localeCompare(b.followup || '9999'));
  else if (sort === 'stage') list.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  else list.sort((a, b) => a.name.localeCompare(b.name));

  const selected = selectedId ? opps.find(o => o.id === selectedId) : null;

  return (
    <div>
      <div className="pipeline-toolbar">
        <input
          className="search-bar"
          type="text"
          placeholder="Search accounts or contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select-sm" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="value">Sort: Value</option>
          <option value="due">Sort: Follow-up date</option>
          <option value="stage">Sort: Stage</option>
        </select>
      </div>
      <div className="stage-filter">
        {['All', ...STAGES].map(f => (
          <button
            key={f}
            className={`filter-chip${stageFilter === f ? ' active' : ''}`}
            onClick={() => setStageFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="pipeline-split">
        <div className={`opp-list-col${selectedId ? ' hide-mobile' : ''}`}>
          <div className="opp-list">
            {list.length === 0 ? (
              <div className="empty-state">No opportunities match your search</div>
            ) : (
              list.map(o => (
                <div
                  key={o.id}
                  className={`opp-card${selectedId === o.id ? ' selected' : ''}`}
                  onClick={() => onSelect(o.id)}
                >
                  <div className="opp-header">
                    <span className="opp-name">{o.name}</span>
                    <Badge stage={o.stage} />
                  </div>
                  <div className="opp-meta">
                    {o.value != null ? <span>${Number(o.value).toLocaleString()}</span> : null}
                    {o.contact ? <span>{o.contact}</span> : null}
                    {o.followup ? (
                      <span className={o.followup < todayStr() ? 'overdue' : ''}>
                        &#x25CF; {fmtDate(o.followup)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className={`detail-col${!selectedId ? ' hide-mobile' : ''}`}>
          {selected ? (
            <>
              <button 
                className="btn btn-sm show-mobile" 
                style={{ marginBottom: 15, width: 'auto' }}
                onClick={() => onSelect(null)}
              >
                ← Back to List
              </button>
              <DetailPanel
                key={selected.id}
                opp={selected}
                onEdit={() => onEdit(selected.id)}
                onDeleted={() => { onSelect(null); onRemove(selected.id); }}
                onUpdate={onUpdate}
              />
            </>
          ) : (
            <div className="empty-state hide-mobile" style={{ paddingTop: '4rem' }}>
              <div className="empty-icon">&#x25A1;</div>
              <div>Select an opportunity to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
