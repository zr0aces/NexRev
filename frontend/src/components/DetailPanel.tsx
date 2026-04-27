import React, { useState } from 'react';
import type { KanbanContext, Opportunity } from '../types';
import Badge from './Badge';
import OppKanban from './OppKanban';
import { api } from '../api';
import { todayStr, fmtDate } from '../utils';

interface Props {
  opp: Opportunity;
  onEdit: () => void;
  onDeleted: () => void;
  onUpdate: (opp: Opportunity) => void;
}

function buildKanbanContext(opp: Opportunity): KanbanContext {
  return {
    todo:     opp.nextSteps.filter(s => s.column === 'todo').map(s => s.text),
    followup: opp.nextSteps.filter(s => s.column === 'followup').map(s => s.text),
    done:     opp.nextSteps.filter(s => s.column === 'done').map(s => s.text),
  };
}

export default function DetailPanel({ opp, onEdit, onDeleted, onUpdate }: Props) {
  const [logInput,   setLogInput]   = useState('');
  const [aiOutput,   setAiOutput]   = useState<{ type: 'ai' | 'sf'; text: string } | null>(null);
  const [aiLoading,  setAiLoading]  = useState<string | null>(null);

  const logRaw = async () => {
    const raw = logInput.trim();
    if (!raw) return;
    const updated = await api.activities.add(opp.id, { raw, ai: false });
    setLogInput('');
    setAiOutput(null);
    onUpdate(updated);
  };

  const logWithAI = async () => {
    const raw = logInput.trim();
    if (!raw) return;
    setAiLoading('Summarizing with AI…');
    try {
      const { summary } = await api.ai.summarize(raw, buildKanbanContext(opp));
      const updated = await api.activities.add(opp.id, { raw, summary, ai: true });
      setAiOutput({ type: 'ai', text: summary });
      setLogInput('');
      onUpdate(updated);
    } catch (e) {
      setAiOutput({ type: 'ai', text: (e as Error).message });
    } finally {
      setAiLoading(null);
    }
  };

  const genSfNote = async () => {
    const recentActs = (opp.activities ?? []).slice(-3).map(a => a.summary ?? a.raw).join('\n---\n');
    if (!recentActs) { alert('Log some activities first before generating an SF note.'); return; }
    setAiLoading('Generating Salesforce note…');
    try {
      const { note } = await api.ai.sfNote({
        oppName: opp.name,
        stage: opp.stage,
        contact: opp.contact,
        recentActivities: recentActs,
        nextStep: opp.nextStep,
        kanban: buildKanbanContext(opp),
      });
      setAiOutput({ type: 'sf', text: note });
    } catch (e) {
      setAiOutput({ type: 'sf', text: (e as Error).message });
    } finally {
      setAiLoading(null);
    }
  };

  const deleteOpp = async () => {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    await api.opportunities.delete(opp.id);
    onDeleted();
  };

  const activities = [...(opp.activities ?? [])].reverse();

  return (
    <div>
      {/* ── Header ── */}
      <div className="detail-header">
        <span className="detail-name">{opp.name}</span>
        <Badge stage={opp.stage} />
        <button className="btn btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={deleteOpp}>Delete</button>
      </div>

      {/* ── Contact / deal meta ── */}
      <div className="detail-meta-grid">
        {opp.contact && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">Contact</span>
            <span>{opp.contact}{opp.contactTitle ? ` — ${opp.contactTitle}` : ''}</span>
          </div>
        )}
        {opp.contactEmail && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">Email</span>
            <a href={`mailto:${opp.contactEmail}`} style={{ color: 'var(--orange-mid)' }}>{opp.contactEmail}</a>
          </div>
        )}
        {opp.contactMobile && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">Mobile</span>
            <a href={`tel:${opp.contactMobile}`} style={{ color: 'inherit' }}>{opp.contactMobile}</a>
          </div>
        )}
        {opp.value != null && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">Value</span>
            <span>${Number(opp.value).toLocaleString()}</span>
          </div>
        )}
        {opp.close && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">Close</span>
            <span>{fmtDate(opp.close)}</span>
          </div>
        )}
        {opp.followup && (
          <div className="detail-meta-item">
            <span className="detail-meta-label">Follow-up</span>
            <span className={opp.followup < todayStr() ? 'overdue' : ''}>{fmtDate(opp.followup)}</span>
          </div>
        )}
        {opp.notes && (
          <div className="detail-meta-item" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-meta-label">Notes&nbsp;</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{opp.notes}</span>
          </div>
        )}
      </div>

      {/* ── Kanban board ── */}
      <div className="detail-section">
        <div className="detail-section-title">Board</div>
        <OppKanban opp={opp} onUpdate={onUpdate} />
      </div>

      {/* ── Activity log input ── */}
      <div className="detail-section">
        <div className="detail-section-title">Log activity / meeting notes</div>
        <textarea
          value={logInput}
          placeholder="Paste raw meeting notes, call summary, or any activity…"
          onChange={e => setLogInput(e.target.value)}
        />
        <div className="log-actions">
          <button className="btn btn-sm btn-primary" onClick={logRaw} disabled={!logInput.trim()}>Log note</button>
          <button className="btn btn-sm" onClick={logWithAI} disabled={!logInput.trim()}>✨ AI summarize</button>
          <button className="btn btn-sm" onClick={genSfNote}>▪ SF update note</button>
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
        <div className="detail-section-title">Activity history ({activities.length})</div>
        {activities.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No activities yet</div>
        ) : (
          activities.map((a, i) => (
            <div key={i} className="activity-item">
              <div className="activity-meta">
                {a.ai && <span className="badge badge-ai" style={{ fontSize: 10 }}>AI</span>}
                <span style={{ fontSize: 12 }}>{a.summary ?? a.raw}</span>
              </div>
              {a.summary && a.raw !== a.summary && (
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
