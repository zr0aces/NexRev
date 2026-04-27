import React from 'react';
import type { KanbanColumn, Opportunity } from '../types';
import { api } from '../api';

interface Props {
  opps: Opportunity[];
  onUpdate: (opp: Opportunity) => void;
}

interface KanbanCard {
  oppId: string;
  oppName: string;
  actIndex: number;
  date: string;
  text: string;
  ai: boolean;
  column: KanbanColumn;
}

const COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'followup', label: 'Follow-ups' },
  { key: 'done', label: 'Done' },
];

const COLUMN_ORDER: KanbanColumn[] = ['todo', 'followup', 'done'];

export default function KanbanPanel({ opps, onUpdate }: Props) {
  const cards: KanbanCard[] = [];
  opps.forEach(o =>
    (o.activities ?? []).forEach((a, i) =>
      cards.push({
        oppId: o.id,
        oppName: o.name,
        actIndex: i,
        date: a.date,
        text: a.summary ?? a.raw,
        ai: a.ai,
        column: a.column ?? 'todo',
      })
    )
  );

  const moveCard = async (card: KanbanCard, direction: 'left' | 'right') => {
    const idx = COLUMN_ORDER.indexOf(card.column);
    const newIdx = direction === 'right' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= COLUMN_ORDER.length) return;
    const updated = await api.activities.moveColumn(card.oppId, card.actIndex, COLUMN_ORDER[newIdx]);
    onUpdate(updated);
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map(col => {
        const colIdx = COLUMN_ORDER.indexOf(col.key);
        const colCards = cards.filter(c => c.column === col.key);
        return (
          <div key={col.key} className="kanban-column">
            <div className="kanban-column-header">
              <span className="kanban-column-title">{col.label}</span>
              <span className="kanban-column-count">{colCards.length}</span>
            </div>
            <div className="kanban-cards">
              {colCards.length === 0 ? (
                <div className="kanban-empty">No items</div>
              ) : (
                colCards.map(card => (
                  <div key={`${card.oppId}-${card.actIndex}`} className="kanban-card">
                    <div className="kanban-card-opp">{card.oppName}</div>
                    <div className="kanban-card-text">{card.text}</div>
                    <div className="kanban-card-footer">
                      <span className="activity-date">{card.date}</span>
                      {card.ai && <span className="badge badge-ai" style={{ fontSize: 10 }}>AI</span>}
                    </div>
                    <div className="kanban-card-actions">
                      {colIdx > 0 && (
                        <button
                          className="btn btn-sm"
                          onClick={() => moveCard(card, 'left')}
                          title="Move left"
                        >
                          ← {COLUMNS[colIdx - 1].label}
                        </button>
                      )}
                      {colIdx < COLUMN_ORDER.length - 1 && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => moveCard(card, 'right')}
                          title="Move right"
                        >
                          {COLUMNS[colIdx + 1].label} →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
