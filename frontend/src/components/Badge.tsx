import React from 'react';
import type { Stage } from '../types';
import { STAGE_COLORS } from '../types';

export default function Badge({ stage }: { stage: Stage }) {
  const color = STAGE_COLORS[stage] ?? 'gray';
  return <span className={`badge badge-${color}`}>{stage}</span>;
}
