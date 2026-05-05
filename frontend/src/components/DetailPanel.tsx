import React, { useState } from 'react';
import { 
  Edit3, 
  Trash2, 
  MessageSquare, 
  Sparkles, 
  Cloud, 
  ClipboardList,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  User as UserIcon,
  Clock
} from 'lucide-react';
import type { Opportunity } from '../types';
import Badge from './Badge';
import OppKanban from './OppKanban';
import { api } from '../api';
import { todayStr, fmtDate } from '../utils';
import { useToast } from '../context/ToastContext';

interface Props {
  opp: Opportunity;
  onEdit: () => void;
  onDeleted: () => void;
  onUpdate: (opp: Opportunity) => void;
}


export default function DetailPanel({ opp, onEdit, onDeleted, onUpdate }: Props) {
  const { addToast } = useToast();
  const [logInput,   setLogInput]   = useState('');
  const [aiOutput,   setAiOutput]   = useState<{ type: 'ai' | 'sf'; text: string } | null>(null);
  const [aiLoading,  setAiLoading]  = useState<string | null>(null);

  const logRaw = async () => {
    const raw = logInput.trim();
    if (!raw) return;
    try {
      const updated = await api.activities.add(opp.id, { raw, ai: false });
      setLogInput('');
      setAiOutput(null);
      onUpdate(updated);
      addToast('Activity logged.', 'success');
    } catch (e) {
      addToast('Failed to log activity: ' + (e as Error).message, 'error');
    }
  };

  const logWithAI = async () => {
    const raw = logInput.trim();
    if (!raw) return;
    setAiLoading('Summarizing with AI…');
    try {
      const { summary } = await api.ai.summarize(raw, opp.id);
      const updated = await api.activities.add(opp.id, { raw, summary, ai: true });
      setAiOutput({ type: 'ai', text: summary });
      setLogInput('');
      onUpdate(updated);
      addToast('AI summary generated and logged.', 'success');
    } catch (e) {
      addToast('AI summarization failed: ' + (e as Error).message, 'error');
      setAiOutput({ type: 'ai', text: (e as Error).message });
    } finally {
      setAiLoading(null);
    }
  };

  const genSfNote = async () => {
    setAiLoading('Generating Salesforce note…');
    try {
      const { note } = await api.ai.sfNote(opp.id);
      setAiOutput({ type: 'sf', text: note });
      const updated = await api.activities.add(opp.id, { raw: note, summary: note, ai: true, sf: true });
      onUpdate(updated);
      addToast('Salesforce note generated.', 'success');
    } catch (e) {
      addToast('Failed to generate SF note: ' + (e as Error).message, 'error');
      setAiOutput({ type: 'sf', text: (e as Error).message });
    } finally {
      setAiLoading(null);
    }
  };

  const extractTasks = async () => {
    setAiLoading('Extracting tasks with AI…');
    try {
      const updated = await api.ai.extractTasks(opp.id);
      onUpdate(updated);
      addToast('Board updated with new tasks extracted from activities.', 'success');
    } catch (e) {
      addToast('Extraction failed: ' + (e as Error).message, 'error');
    } finally {
      setAiLoading(null);
    }
  };


  const deleteOpp = async () => {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    try {
      await api.opportunities.delete(opp.id);
      addToast('Opportunity deleted.', 'info');
      onDeleted();
    } catch (e) {
      addToast('Delete failed: ' + (e as Error).message, 'error');
    }
  };

  const activities = [...(opp.activities ?? [])].reverse();

  return (
    <div>
      {/* ── Header ── */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span className="detail-name">{opp.name}</span>
          <Badge stage={opp.stage} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={onEdit} title="Edit">
            <Edit3 size={14} /> <span className="hide-mobile">Edit</span>
          </button>
          <button className="btn btn-sm btn-danger" onClick={deleteOpp} title="Delete">
            <Trash2 size={14} /> <span className="hide-mobile">Delete</span>
          </button>
        </div>
      </div>

      {/* ── Contact / deal meta ── */}
      <div className="detail-meta-grid">
        {opp.contact && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><UserIcon size={12} /> Contact</span>
            <span>{opp.contact}{opp.contactTitle ? ` — ${opp.contactTitle}` : ''}</span>
          </div>
        )}
        {opp.contactEmail && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><Mail size={12} /> Email</span>
            <a href={`mailto:${opp.contactEmail}`} style={{ color: 'var(--orange-mid)' }}>{opp.contactEmail}</a>
          </div>
        )}
        {opp.contactMobile && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><Phone size={12} /> Mobile</span>
            <a href={`tel:${opp.contactMobile}`} style={{ color: 'inherit' }}>{opp.contactMobile}</a>
          </div>
        )}
        {opp.value != null && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><DollarSign size={12} /> Value</span>
            <span>${Number(opp.value).toLocaleString()}</span>
          </div>
        )}
        {opp.close && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><Calendar size={12} /> Close</span>
            <span>{fmtDate(opp.close)}</span>
          </div>
        )}
        {opp.followup && (
          <div className="detail-meta-item">
            <span className="detail-meta-label"><Clock size={12} /> Follow-up</span>
            <span className={opp.followup < todayStr() ? 'overdue' : ''}>{fmtDate(opp.followup)}</span>
          </div>
        )}
        {opp.notes && (
          <div className="detail-meta-item" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-meta-label"><MessageSquare size={12} /> Notes&nbsp;</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{opp.notes}</span>
          </div>
        )}
      </div>

      {/* ── Kanban board ── */}
      <div className="detail-section">
        <div className="detail-section-title"><ClipboardList size={16} /> Board</div>
        <OppKanban opp={opp} onUpdate={onUpdate} />
      </div>

      {/* ── Activity log input ── */}
      <div className="detail-section">
        <div className="detail-section-title"><MessageSquare size={16} /> Log activity / meeting notes</div>
        <textarea
          value={logInput}
          placeholder="Paste raw meeting notes, call summary, or any activity…"
          onChange={e => setLogInput(e.target.value)}
        />
        <div className="log-actions">
          <button className="btn btn-sm btn-primary" onClick={logRaw} disabled={!logInput.trim()} title="Log the raw note to history">
            <MessageSquare size={14} /> Log note
          </button>
          <button className="btn btn-sm" onClick={logWithAI} disabled={!logInput.trim()} title="Start here to generate a concise summary of the logged note">
            <Sparkles size={14} /> AI summarize
          </button>
          <button className="btn btn-sm" onClick={extractTasks} title="Identify and populate actionable items into the Kanban Board">
            <ClipboardList size={14} /> Extract tasks
          </button>
          <button className="btn btn-sm" onClick={genSfNote} title="Synchronize notes with Salesforce (SFDC)">
            <Cloud size={14} /> SF update note
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>
          Recommended: Start with <b>AI Summarize</b>, then <b>Extract Tasks</b>, and finally <b>SF Update</b>.
        </div>
        {aiLoading && (
          <div className="ai-box"><span className="spinner" />{aiLoading}</div>
        )}
        {!aiLoading && aiOutput && (
          aiOutput.type === 'sf' ? (
            <>
              <div className="ai-label" style={{ marginTop: 10 }}>Salesforce-ready note — copy &amp; paste directly</div>
              <div className="sf-box">{aiOutput.text}</div>
            </>
          ) : (
            <>
              <div className="ai-label" style={{ marginTop: 10 }}>AI Summary</div>
              <div className="ai-box">{aiOutput.text}</div>
            </>
          )
        )}
      </div>

      {/* ── Activity history ── */}
      <div className="detail-section">
        <div className="detail-section-title"><Clock size={16} /> Activity history ({activities.length})</div>
        {activities.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No activities yet</div>
        ) : (
          activities.map((a, i) => (
            <div key={`${a.date}-${i}`} className="activity-item">
              <div className="activity-meta">
                {a.sf && <span className="badge badge-sf" title="Salesforce Source"><Cloud size={10} /> SF</span>}
                {a.ai && !a.sf && <span className="badge badge-ai" title="AI Generated"><Sparkles size={10} /> AI</span>}
              </div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 4, color: 'var(--text)' }}>
                {a.summary ?? a.raw}
              </div>
              {a.summary && !a.sf && a.raw !== a.summary && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Raw: {a.raw.slice(0, 80)}{a.raw.length > 80 ? '…' : ''}
                </div>
              )}
              <div className="activity-date">{a.date}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
