import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowUpDown, ArrowLeft, ChevronDown } from 'lucide-react';
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
  aiEnabled: boolean;
}

export default function PipelinePanel({ opps, selectedId, onSelect, onEdit, onUpdate, onRemove, aiEnabled }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [stageFilter, setStageFilter] = useState('All');

  // Refs for scroll-to-selected behaviour
  const listColRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  let list = [...opps];
  if (stageFilter !== 'All') list = list.filter(o => o.stage === stageFilter);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.contact ?? '').toLowerCase().includes(q)
    );
  }
  if (sort === 'value') list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  else if (sort === 'due') list.sort((a, b) => (a.followup || '9999').localeCompare(b.followup || '9999'));
  else if (sort === 'stage') list.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  else list.sort((a, b) => a.name.localeCompare(b.name));

  const selected = selectedId ? opps.find(o => o.id === selectedId) : null;

  // ── Auto-scroll selected card into view ──────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const el = cardRefs.current.get(selectedId);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedId]);

  // ── Keyboard navigation (↑ ↓ Enter Escape) ───────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!list.length) return;
    const currentIdx = selectedId ? list.findIndex(o => o.id === selectedId) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIdx < list.length - 1 ? currentIdx + 1 : 0;
      onSelect(list[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIdx > 0 ? currentIdx - 1 : list.length - 1;
      onSelect(list[prev].id);
    } else if (e.key === 'Escape') {
      onSelect(null);
    }
  }, [list, selectedId, onSelect]);

  const today = todayStr();

  return (
    <div className="pipeline-wrapper">
      {/* ── Toolbar ── */}
      <div className="pipeline-toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            className="search-bar"
            type="text"
            placeholder="Search accounts or contacts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ArrowUpDown size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
          <select className="select-sm" value={sort} onChange={e => setSort(e.target.value)} style={{ paddingLeft: 30, paddingRight: 10 }}>
            <option value="name">Name</option>
            <option value="value">Value</option>
            <option value="due">Follow-up</option>
            <option value="stage">Stage</option>
          </select>
        </div>
        <span className="pipeline-count">{list.length} {list.length === 1 ? 'result' : 'results'}</span>
      </div>

      {/* ── Stage filter chips (horizontal scroll, no wrap) ── */}
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

      {/* ── Split layout (both columns scroll independently) ── */}
      <div className="pipeline-split">
        {/* List column — keyboard navigable */}
        <div
          className={`opp-list-col${selectedId ? ' hide-mobile' : ''}`}
          ref={listColRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Opportunities list — use arrow keys to navigate"
          style={{ outline: 'none' }}
        >
          <div className="opp-list">
            {list.length === 0 ? (
              <div className="empty-state">No opportunities match your search</div>
            ) : (
              list.map(o => {
                const isOverdue = o.followup && o.followup < today;
                const activityCount = o.activities?.length ?? 0;
                const pendingCount = o.nextSteps?.filter(s => !s.done).length ?? 0;

                return (
                  <div
                    key={o.id}
                    ref={el => {
                      if (el) cardRefs.current.set(o.id, el);
                      else cardRefs.current.delete(o.id);
                    }}
                    className={`opp-card${selectedId === o.id ? ' selected' : ''}`}
                    onClick={() => onSelect(o.id)}
                    tabIndex={-1}
                    role="button"
                    aria-selected={selectedId === o.id}
                  >
                    {/* Row 1: name + stage badge */}
                    <div className="opp-header">
                      <span className="opp-name">{o.name}</span>
                      <Badge stage={o.stage} />
                    </div>

                    {/* Row 2: value • contact • followup date */}
                    <div className="opp-meta">
                      {o.value != null && (
                        <span className="opp-meta-value">${Number(o.value).toLocaleString()}</span>
                      )}
                      {o.contact ? <span>{o.contact}</span> : null}
                      {o.followup ? (
                        <span className={isOverdue ? 'overdue' : ''}>
                          {isOverdue ? '⚠ ' : '● '}{fmtDate(o.followup)}
                        </span>
                      ) : null}
                    </div>

                    {/* Row 3: next step preview */}


                    {/* Row 4: counters */}
                    {(activityCount > 0 || pendingCount > 0) && (
                      <div className="opp-counters">
                        {activityCount > 0 && (
                          <span className="opp-counter">{activityCount} {activityCount === 1 ? 'activity' : 'activities'}</span>
                        )}
                        {pendingCount > 0 && (
                          <span className="opp-counter opp-counter--pending">{pendingCount} pending</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {/* Keyboard hint — only visible on desktop when list has items */}
          {list.length > 1 && (
            <div className="pipeline-kbd-hint">↑ ↓ to navigate · Enter to open</div>
          )}
        </div>

        {/* Detail column */}
        <div className={`detail-col${!selectedId ? ' hide-mobile' : ''}`}>
          {selected ? (
            <>
              <button
                className="btn btn-sm show-mobile"
                style={{ marginBottom: 15, width: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => onSelect(null)}
              >
                <ArrowLeft size={16} /> Back to List
              </button>
              <DetailPanel
                key={selected.id}
                opp={selected}
                onEdit={() => onEdit(selected.id)}
                onDeleted={() => { onSelect(null); onRemove(selected.id); }}
                onUpdate={onUpdate}
                aiEnabled={aiEnabled}
              />
            </>
          ) : (
            <div className="empty-state hide-mobile" style={{ paddingTop: '4rem' }}>
              <div className="empty-icon">&#x25A1;</div>
              <div>Select an opportunity to view details</div>
              <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-tertiary)' }}>
                Click a card or use ↑↓ keys
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
