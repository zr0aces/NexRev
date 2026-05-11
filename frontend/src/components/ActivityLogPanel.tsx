import React, { useMemo, useState } from 'react';
import {
  History,
  Sparkles,
  Inbox,
  MessageSquare,
  Cloud,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  ArrowUpDown,
  X,
} from 'lucide-react';
import type { Opportunity } from '../types';
import { STAGE_COLORS } from '../types';
import Badge from './Badge';

interface Props {
  opps: Opportunity[];
  onSelectOpp?: (id: string) => void;
}

type FilterType = 'all' | 'ai' | 'sf' | 'manual';
type GroupMode  = 'date' | 'opp';

interface ActivityRow {
  id?: number;
  date: string;
  raw: string;
  summary?: string;
  ai: boolean;
  sf?: boolean;
  oppName: string;
  oppId: string;
  oppStage: string;
}

// Format ISO date string to readable label
function dateLabel(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityLogPanel({ opps, onSelectOpp }: Props) {
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<FilterType>('all');
  const [group, setGroup]       = useState<GroupMode>('date');

  // Flatten all activities across all opportunities
  const all: ActivityRow[] = useMemo(() => {
    const rows: ActivityRow[] = [];
    opps.forEach(o =>
      (o.activities ?? []).forEach(a =>
        rows.push({ ...a, oppName: o.name, oppId: o.id, oppStage: o.stage })
      )
    );
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [opps]);

  // Summary stats
  const stats = useMemo(() => ({
    total:  all.length,
    ai:     all.filter(a => a.ai && !a.sf).length,
    sf:     all.filter(a => a.sf).length,
    manual: all.filter(a => !a.ai).length,
  }), [all]);

  // Filter + search
  const filtered = useMemo(() => {
    let rows = all;
    if (filter === 'ai')     rows = rows.filter(a => a.ai && !a.sf);
    if (filter === 'sf')     rows = rows.filter(a => !!a.sf);
    if (filter === 'manual') rows = rows.filter(a => !a.ai);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(a =>
        a.oppName.toLowerCase().includes(q) ||
        (a.summary ?? a.raw).toLowerCase().includes(q)
      );
    }
    return rows;
  }, [all, filter, search]);

  // Group the filtered list
  const groups: { key: string; label: string; items: ActivityRow[] }[] = useMemo(() => {
    if (group === 'opp') {
      const map = new Map<string, { label: string; stage: string; items: ActivityRow[] }>();
      filtered.forEach(a => {
        if (!map.has(a.oppId)) map.set(a.oppId, { label: a.oppName, stage: a.oppStage, items: [] });
        map.get(a.oppId)!.items.push(a);
      });
      return Array.from(map.entries()).map(([id, g]) => ({
        key: id,
        label: `${g.label} · ${g.items.length}`,
        items: g.items,
      }));
    }
    // Group by date
    const map = new Map<string, ActivityRow[]>();
    filtered.forEach(a => {
      const day = a.date.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    });
    return Array.from(map.entries()).map(([day, items]) => ({
      key: day,
      label: dateLabel(day),
      items,
    }));
  }, [filtered, group]);

  return (
    <div className="log-panel">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="log-header">
        <div className="log-header-left">
          <div className="log-header-icon">
            <History size={20} />
          </div>
          <div>
            <div className="log-header-title">Activity Log</div>
            <div className="log-header-sub">
              {stats.total} {stats.total === 1 ? 'entry' : 'entries'} across {opps.filter(o => (o.activities?.length ?? 0) > 0).length} accounts
            </div>
          </div>
        </div>

        {/* Summary stat chips */}
        {stats.total > 0 && (
          <div className="log-stats">
            <button
              className={`log-stat-chip${filter === 'all' ? ' active' : ''}`}
              onClick={() => setFilter('all')}
            >
              <TrendingUp size={12} />
              <span>{stats.total} Total</span>
            </button>
            <button
              className={`log-stat-chip log-stat-chip--ai${filter === 'ai' ? ' active' : ''}`}
              onClick={() => setFilter(filter === 'ai' ? 'all' : 'ai')}
            >
              <Sparkles size={12} />
              <span>{stats.ai} AI</span>
            </button>
            <button
              className={`log-stat-chip log-stat-chip--sf${filter === 'sf' ? ' active' : ''}`}
              onClick={() => setFilter(filter === 'sf' ? 'all' : 'sf')}
            >
              <Cloud size={12} />
              <span>{stats.sf} SF</span>
            </button>
            <button
              className={`log-stat-chip log-stat-chip--manual${filter === 'manual' ? ' active' : ''}`}
              onClick={() => setFilter(filter === 'manual' ? 'all' : 'manual')}
            >
              <MessageSquare size={12} />
              <span>{stats.manual} Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Toolbar ──────────────────────────────────────── */}
      {stats.total > 0 && (
        <div className="log-toolbar">
          <div className="log-search-wrap">
            <Search size={14} className="log-search-icon" />
            <input
              className="log-search"
              type="text"
              placeholder="Search activities or accounts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                className="log-search-clear" 
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="log-toolbar-right">
            <div className="log-group-toggle">
              <button
                className={`log-group-btn${group === 'date' ? ' active' : ''}`}
                onClick={() => setGroup('date')}
                title="Group by date"
              >
                <Calendar size={13} /> Date
              </button>
              <button
                className={`log-group-btn${group === 'opp' ? ' active' : ''}`}
                onClick={() => setGroup('opp')}
                title="Group by account"
              >
                <ArrowUpDown size={13} /> Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────── */}
      {all.length === 0 ? (
        <div className="log-empty">
          <div className="log-empty-icon"><Inbox size={40} /></div>
          <div className="log-empty-title">No activities logged yet</div>
          <div className="log-empty-sub">Open any opportunity in the Pipeline and log a meeting note or call summary.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="log-empty">
          <div className="log-empty-icon"><Filter size={32} /></div>
          <div className="log-empty-title">No results</div>
          <div className="log-empty-sub">Try a different search term or filter.</div>
        </div>
      ) : (
        <div className="log-groups">
          {groups.map(g => (
            <div key={g.key} className="log-group">
              <div className="log-group-label">
                {group === 'date' ? <Calendar size={12} /> : <MessageSquare size={12} />}
                {g.label}
                <span className="log-group-count">{g.items.length}</span>
              </div>
              <div className="log-group-items">
                {g.items.map((a, i) => (
                  <div
                    key={a.id ?? `${a.oppId}-${a.date}-${i}`}
                    className="log-item"
                  >
                    {/* Left accent */}
                    <div className={`log-item-accent ${a.sf ? 'sf' : a.ai ? 'ai' : 'manual'}`} />

                    <div className="log-item-body">
                      {/* Row 1: account name + badges + date */}
                      <div className="log-item-top">
                        <button
                          className="log-item-opp"
                          onClick={() => onSelectOpp?.(a.oppId)}
                          title={`Open ${a.oppName}`}
                        >
                          <MessageSquare size={11} />
                          {a.oppName}
                        </button>
                        <div className="log-item-badges">
                          {a.sf && (
                            <span className="badge badge-sf">
                              <Cloud size={9} /> SF
                            </span>
                          )}
                          {a.ai && !a.sf && (
                            <span className="badge badge-ai">
                              <Sparkles size={9} /> AI
                            </span>
                          )}
                        </div>
                        <span className="log-item-date">
                          {group === 'opp' ? dateLabel(a.date.slice(0, 10)) : a.date.slice(11, 16) || a.date.slice(0, 10)}
                        </span>
                      </div>

                      {/* Row 2: content */}
                      <div className="log-item-content">
                        {a.summary ?? a.raw}
                      </div>

                      {/* Row 3: raw preview if AI-summarised */}
                      {a.summary && a.raw !== a.summary && !a.sf && (
                        <div className="log-item-raw">
                          Raw: {a.raw.slice(0, 100)}{a.raw.length > 100 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
