import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Inbox, 
  LayoutDashboard, 
  Search, 
  User, 
  Sun,
  ArrowUpDown,
  Filter,
  TrendingUp,
  DollarSign,
  Snowflake
} from 'lucide-react';
import type { Opportunity } from '../types';
import MetricsRow from './MetricsRow';
import Badge from './Badge';
import { todayStr, fmtDate, daysUntil, daysSince } from '../utils';
import { api } from '../api';

interface Props {
  opps: Opportunity[];
  username: string;
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

export default function TodayPanel({ opps, username, onSelect, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'urgency' | 'updated'>('urgency');
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    api.auth.listUsers().then(data => {
      setUsers(data.map(u => u.username));
    }).catch(err => {
      console.error('Failed to fetch users:', err);
    });
  }, []);

  let pending = opps
    .filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');

  if (userFilter !== 'all') {
    pending = pending.filter(o => o.updatedBy === userFilter);
  }

  if (search) {
    const q = search.toLowerCase();
    pending = pending.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.contact ?? '').toLowerCase().includes(q)
    );
  }

  pending.sort((a, b) => {
    if (sortMode === 'updated') {
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    }
    const pa = urgencyInfo(a).priority;
    const pb = urgencyInfo(b).priority;
    if (pa !== pb) return pa - pb;
    return (a.followup ?? '').localeCompare(b.followup ?? '');
  });

  return (
    <div className="today-panel">
      {/* ── Page Header ── */}
      <div className="log-header">
        <div className="log-header-left">
          <div className="log-header-icon" style={{ background: 'var(--orange-light)', border: '1px solid rgba(249, 115, 22, 0.2)', color: 'var(--orange)' }}>
            <Sun size={20} />
          </div>
          <div>
            <div className="log-header-title">Today</div>
            <div className="log-header-sub">
              {pending.length} {pending.length === 1 ? 'opportunity' : 'opportunities'} requiring attention
            </div>
          </div>
        </div>
        
        {/* Legendary urgency indicators moved to a cleaner stat group */}
        <div className="log-stats">
          <div className="log-stat-chip">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
            <span>Overdue</span>
          </div>
          <div className="log-stat-chip">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber-mid)' }} />
            <span>Due Soon</span>
          </div>
          <div className="log-stat-chip">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
            <span>Later</span>
          </div>
        </div>
      </div>

      <MetricsRow opps={opps} />

      {/* ── Toolbar ── */}
      <div className="pipeline-toolbar" style={{ marginTop: 24, marginBottom: 16 }}>
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

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
            <select 
              className="select-sm" 
              style={{ paddingLeft: 30 }}
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            >
              <option value="all">All Users</option>
              {users.map(u => (
                <option key={u} value={u}>{u === username ? 'Me' : u.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <ArrowUpDown size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
            <select 
              className="select-sm" 
              style={{ paddingLeft: 30 }}
              value={sortMode}
              onChange={e => setSortMode(e.target.value as any)}
            >
              <option value="urgency">Urgency</option>
              <option value="updated">Last Updated</option>
            </select>
          </div>
        </div>
        
        <span className="pipeline-count">{pending.length} results</span>
      </div>

      {/* ── Grid ── */}
      {pending.length === 0 ? (
        <div className="log-empty">
          <div className="log-empty-icon"><Inbox size={48} /></div>
          <div className="log-empty-title">{search ? 'No matches found' : 'Everything up to date'}</div>
          <div className="log-empty-sub">{search ? 'Try a different search term or filter.' : 'No pending actions. Add opportunities to get started.'}</div>
        </div>
      ) : (
        <div className="today-grid">
          {pending.map(o => {
            const { label, icon, dotColor } = urgencyInfo(o);
            const lastUpdateStr = o.updatedAt ? new Date(o.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
            const pendingSteps = o.nextSteps?.filter(s => !s.done) || [];
            const latestActivityDate = o.activities?.length 
              ? o.activities[o.activities.length - 1].date 
              : o.createdAt;
            const coldDays = daysSince(latestActivityDate) ?? 0;
            const isCold = coldDays >= 7;
            
            return (
              <div
                key={o.id}
                className={`today-card${isCold ? ' cold' : ''}`}
                onClick={() => onSelect(o.id)}
              >
                <div className="today-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="today-card-dot" style={{ background: dotColor }} />
                    {isCold && (
                      <div className="cold-badge" title={`${coldDays} days since last activity`}>
                        <Snowflake size={10} strokeWidth={3} />
                        COLD
                      </div>
                    )}
                    <Badge stage={o.stage} />
                  </div>
                  {o.value != null && (
                    <div className="opp-meta-value" style={{ fontSize: '13px' }}>
                      ${Number(o.value).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="today-card-body">
                  <div className="today-card-name">{o.name}</div>
                  {o.contact && (
                    <div className="today-card-contact" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                       <User size={12} style={{ opacity: 0.6 }} /> {o.contact}
                    </div>
                  )}
                  
                  {label && (
                    <div className="today-card-urgency" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      {icon} {label}
                    </div>
                  )}

                  {pendingSteps.length > 0 && (
                    <div className="today-card-footer">
                      <div className="today-card-next">
                        <CheckCircle2 size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{pendingSteps[0].text}</span>
                      </div>
                      {pendingSteps.length > 1 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4, marginLeft: 16 }}>
                          + {pendingSteps.length - 1} more pending task{pendingSteps.length > 2 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="today-card-meta" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <User size={12} /> {o.updatedBy ? (o.updatedBy === username ? 'Me' : o.updatedBy.toUpperCase()) : 'System'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {lastUpdateStr}
                  </div>
                </div>

                <div className="today-card-accent" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
