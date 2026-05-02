import React, { useRef } from 'react';
import { 
  FileUp, 
  Save, 
  FileDown, 
  Plus, 
  LogOut, 
  Share, 
  Rocket 
} from 'lucide-react';
import type { Opportunity } from '../types';
import { api } from '../api';
import { todayStr, fmtDate } from '../utils';
import { useToast } from '../context/ToastContext';
import type { ToastType } from '../context/ToastContext';

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
    if (o.nextStep)     lines.push(`- **Next step:** ${o.nextStep}`);
    if (o.notes)        lines.push('', '**Notes:**', '', o.notes);
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
  const fileRef = useRef<HTMLInputElement>(null);

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
      <div className="nav-brand">
        <div className="nav-brand-icon">
          <Rocket size={14} />
        </div>
        <span className="nav-title">NexRev</span>
      </div>
      <div className="nav-divider" />
      <div className="nav-tabs">
        {(['today', 'pipeline', 'log', 'profile'] as Tab[]).map(t => (
          <button
            key={t}
            className={`nav-tab${tab === t ? ' active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {t === 'today' ? 'Today' : t === 'pipeline' ? 'Pipeline' : t === 'log' ? 'Activity Log' : 'Profile'}
          </button>
        ))}
      </div>
      <div className="nav-actions">
        <div className="hide-mobile" style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => exportMd(opps, addToast)}>
            <FileUp size={14} /> Export
          </button>
          <button className="btn btn-sm" onClick={() => downloadFile(`nexrev-backup-${todayStr()}.json`, JSON.stringify(opps, null, 2), 'application/json')}>
            <Save size={14} /> Backup
          </button>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <FileDown size={14} /> Import
          </button>
        </div>
        
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        
        <div className="nav-divider hide-mobile" />
        
        <button className="btn btn-sm btn-primary hide-mobile" onClick={onAddClick}>
          <Plus size={14} /> Add Opportunity
        </button>
        
        {username && (
          <div className="nav-user hide-mobile">
            <span className="nav-user-name">{username}</span>
          </div>
        )}

        <div className="show-mobile">
          <button className="btn btn-sm" onClick={() => {
            if (confirm('Export to Markdown?')) exportMd(opps, addToast);
          }} title="Export MD">
            <Share size={16} />
          </button>
        </div>
        
        <button className="btn btn-sm" onClick={onLogout} title="Sign out">
          <span className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={14} /> Sign out
          </span>
          <span className="show-mobile">
            <LogOut size={16} />
          </span>
        </button>
      </div>
    </nav>
  );
}
