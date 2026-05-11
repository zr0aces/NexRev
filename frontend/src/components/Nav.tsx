import React, { useRef, useState, useEffect } from 'react';
import { 
  FileUp, 
  Save, 
  FileDown, 
  Plus, 
  LogOut, 
  Rocket,
  Sun,
  Moon,
  ChevronDown,
  Settings,
  User
} from 'lucide-react';
import type { Opportunity } from '../types';
import { api } from '../api';
import { todayStr, fmtDate } from '../utils';
import { useToast } from '../context/ToastContext';
import type { ToastType } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

type Tab = 'today' | 'pipeline' | 'log' | 'profile';

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onAddClick: () => void;
  opps: Opportunity[];
  onImport: () => void;
  onLogout: () => void;
  username?: string;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportMd(opps: Opportunity[], addToast: (message: string, type?: ToastType) => void) {
  const t = todayStr();
  const active = opps.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');
  const isOverdue = (d: string) => !!d && d < t;
  const lines = [
    '# NexRev', '',
    `_Exported: ${t}_`, '',
    '## Summary', '',
    `- Active opportunities: ${active.length}`,
    `- Pipeline value: $${active.reduce((s, o) => s + (o.value ?? 0), 0).toLocaleString()}`,
    `- Overdue follow-ups: ${active.filter(o => isOverdue(o.followup)).length}`,
    `- Closed won (all time): ${opps.filter(o => o.stage === 'Closed Won').length}`,
    '', '---', '', '## Opportunities', '',
  ];
  opps.forEach(o => {
    lines.push(`### ${o.name}`, '');
    lines.push(`- **Stage:** ${o.stage}`);
    if (o.contact)      lines.push(`- **Contact:** ${o.contact}`);
    if (o.contactTitle) lines.push(`- **Title:** ${o.contactTitle}`);
    if (o.contactEmail) lines.push(`- **Email:** ${o.contactEmail}`);
    if (o.contactMobile) lines.push(`- **Mobile:** ${o.contactMobile}`);
    if (o.value)        lines.push(`- **Value:** $${Number(o.value).toLocaleString()}`);
    if (o.close)        lines.push(`- **Close date:** ${fmtDate(o.close)}`);
    if (o.followup)     lines.push(`- **Follow-up:** ${fmtDate(o.followup)}${isOverdue(o.followup) ? ' ⚠️ OVERDUE' : ''}`);

    if (o.nextSteps?.length) {
      lines.push('', '**Board:**', '');
      ['todo', 'followup', 'done'].forEach(col => {
        const items = o.nextSteps.filter(s => (s.column ?? 'todo') === col);
        if (items.length) {
          const label = col === 'todo' ? 'To Do' : col === 'followup' ? 'Follow-ups' : 'Done';
          lines.push(`*${label}:*`);
          items.forEach(s => lines.push(`- ${s.text}`));
        }
      });
    }
    if (o.activities?.length) {
      lines.push('', '**Activity log:**', '');
      [...o.activities].reverse().forEach(a => {
        lines.push(`_${a.date}${a.ai ? ' · AI summary' : ''}_`, '', a.summary ?? a.raw, '');
      });
    }
    lines.push('---', '');
  });
  downloadFile(`nexrev-${t}.md`, lines.join('\n'), 'text/markdown');
  addToast('Exported to Markdown.', 'success');
}

export default function Nav({ tab, onTabChange, onAddClick, opps, onImport, onLogout, username }: Props) {
  const { addToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const initials = username ? username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(data)) throw new Error('Invalid format — expected a JSON array');
        if (!confirm(`Import ${data.length} opportunities? Existing IDs will be skipped.`)) return;
        const { imported } = await api.opportunities.import(data);
        addToast(`Imported ${imported} new opportunities.`, 'success');
        onImport();
      } catch (err) {
        addToast('Import failed: ' + (err as Error).message, 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <nav className="nav">
      <div className="nav-left">
        <div className="nav-brand-wrapper">
          <div className="nav-brand">
            <div className="nav-brand-icon">
              <Rocket size={16} strokeWidth={3} />
            </div>
            <span className="nav-title">NexRev</span>
          </div>
        </div>

        <div className="nav-tabs">
          {(['today', 'pipeline', 'log', 'profile'] as Tab[]).map(t => (
            <button
              key={t}
              className={`nav-tab${tab === t ? ' active' : ''}`}
              onClick={() => onTabChange(t)}
            >
              {t === 'today' ? 'Today' : t === 'pipeline' ? 'Pipeline' : t === 'log' ? 'Logs' : 'Profile'}
            </button>
          ))}
        </div>
      </div>

      <div className="nav-center hide-mobile" />

      <div className="nav-right">
        <div className="nav-right-wrapper">
          <div className="nav-actions">
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            
            <button className="btn btn-primary hide-mobile" onClick={onAddClick}>
              <Plus size={18} strokeWidth={2.5} />
              <span>Add Opportunity</span>
            </button>
            
            <div className="nav-divider hide-mobile" />

            {/* Unified Profile & Actions Dropdown */}
            {username && (
              <div className="nav-profile-container" ref={dropdownRef}>
                <button className="nav-profile-trigger" onClick={() => setIsOpen(!isOpen)}>
                  <div className="hide-mobile nav-profile-info">
                    <div className="nav-user-name">{username?.toUpperCase()}</div>
                  </div>
                  <div className="nav-avatar">
                    {initials}
                  </div>
                  <ChevronDown size={14} className={`dropdown-arrow ${isOpen ? 'open' : ''}`} />
                </button>

                {isOpen && (
                  <div className="profile-dropdown animate-entry">
                    <div className="dropdown-header">
                      <span className="dropdown-title">System Tools</span>
                    </div>
                    
                    <div className="dropdown-action-row">
                      <button className="dropdown-btn" onClick={() => { toggleTheme(); setIsOpen(false); }} title="Switch Theme">
                        <div className="dropdown-btn-inner">
                          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                          <span className="btn-hint">Theme</span>
                        </div>
                      </button>
                      <button className="dropdown-btn" onClick={() => { exportMd(opps, addToast); setIsOpen(false); }} title="Export Markdown">
                        <div className="dropdown-btn-inner">
                          <FileUp size={18} />
                          <span className="btn-hint">Export</span>
                        </div>
                      </button>
                      <button className="dropdown-btn" onClick={() => { downloadFile(`nexrev-backup-${todayStr()}.json`, JSON.stringify(opps, null, 2), 'application/json'); setIsOpen(false); }} title="Backup JSON">
                        <div className="dropdown-btn-inner">
                          <Save size={18} />
                          <span className="btn-hint">Backup</span>
                        </div>
                      </button>
                      <button className="dropdown-btn" onClick={() => { fileRef.current?.click(); setIsOpen(false); }} title="Import JSON">
                        <div className="dropdown-btn-inner">
                          <FileDown size={18} />
                          <span className="btn-hint">Import</span>
                        </div>
                      </button>
                    </div>

                    <div className="dropdown-divider" />
                    
                    <button className="dropdown-item" onClick={() => { onTabChange('profile'); setIsOpen(false); }}>
                      <User size={16} />
                      <span>View Profile</span>
                    </button>
                    
                    <button className="dropdown-item logout" onClick={onLogout}>
                      <LogOut size={16} />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
