import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Calendar, CheckCircle2, Inbox, LayoutDashboard, Search, User } from 'lucide-react';
import type { Opportunity } from '../types';
import MetricsRow from './MetricsRow';
import Badge from './Badge';
import { todayStr, fmtDate, daysUntil } from '../utils';
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

        <div className="pipeline-toolbar" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
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

          <div style={{ display: 'flex', gap: 8 }}>
            <select 
              className="search-bar" 
              style={{ width: 'auto', padding: '0 12px', fontSize: '13px' }}
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            >
              <option value="all">All Users</option>
              {users.map(u => (
                <option key={u} value={u}>{u === username ? 'Me' : u.toUpperCase()}</option>
              ))}
            </select>

            <select 
              className="search-bar" 
              style={{ width: 'auto', padding: '0 12px', fontSize: '13px' }}
              value={sortMode}
              onChange={e => setSortMode(e.target.value as any)}
            >
              <option value="urgency">Sort: Urgency</option>
              <option value="updated">Sort: Last Updated</option>
            </select>
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
              const lastUpdateStr = o.updatedAt ? new Date(o.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
              
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
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {label && (
                        <div className="today-card-urgency" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          {icon} {label}
                        </div>
                      )}
                      {o.updatedBy && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} /> {o.updatedBy === username ? 'Me' : o.updatedBy.toUpperCase()} • {lastUpdateStr}
                        </div>
                      )}
                    </div>
                  </div>

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
