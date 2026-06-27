'use client';

import React from 'react';
import {
  GATE_STATUS_META,
  GateStatus,
  PROJECT_STATUS_META,
  ProjectStatus,
  READINESS_META,
  ReadinessStatus,
} from './npi';
import { DEPENDENCY_STATUS_META, DependencyStatus } from './launch';

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}1a` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  const m = PROJECT_STATUS_META[status] ?? {
    label: status,
    color: '#9ca3af',
  };
  return <Pill label={m.label} color={m.color} />;
}

export function GateStatusPill({ status }: { status: GateStatus }) {
  const m = GATE_STATUS_META[status] ?? { label: status, color: '#9ca3af' };
  return <Pill label={m.label} color={m.color} />;
}

export function ReadinessPill({ status }: { status: ReadinessStatus }) {
  const m = READINESS_META[status] ?? { label: status, color: '#9ca3af' };
  return <Pill label={m.label} color={m.color} />;
}

export function DependencyStatusPill({ status }: { status: DependencyStatus }) {
  const m = DEPENDENCY_STATUS_META[status] ?? { label: status, color: '#9ca3af' };
  return <Pill label={m.label} color={m.color} />;
}

/** A bare colored dot for compact readiness display. */
export function ReadinessDot({ status }: { status: ReadinessStatus }) {
  const m = READINESS_META[status] ?? { label: status, color: '#9ca3af' };
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ background: m.color }}
      title={m.label}
    />
  );
}
