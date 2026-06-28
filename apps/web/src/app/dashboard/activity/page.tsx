'use client';

import React, { useState } from 'react';
import { ScrollText, ListTree, History } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { TimelineView } from './components/TimelineView';
import { EntityHistoryView, type EntityQuery } from './components/EntityHistoryView';

const ACCENT = '#7c5cff';

type View = 'timeline' | 'history';

/**
 * Visor del Event Ledger — la bitácora inmutable del piso.
 *
 * Dos lentes sobre la misma fuente de verdad:
 *   • Línea de tiempo: feed global de eventos con filtros por dominio/entidad/fecha.
 *   • Historial por entidad: la línea de vida completa de una WO / serial / NCR.
 *
 * Es la pantalla que hace que la app se sienta auditable y confiable: todo lo que
 * pasa en el piso queda registrado, y aquí se puede mirar y rastrear.
 *
 * Disciplina de carril ACTIVITY: esta vista vive entera bajo dashboard/activity/**
 * y solo consume la API del ledger; no edita backend ni navegación global.
 */
export default function ActivityPage() {
  const [view, setView] = useState<View>('timeline');
  const [entityQuery, setEntityQuery] = useState<EntityQuery | null>(null);

  // Saltar del feed global al historial de la entidad de un evento.
  function pickReference(referenceType: string, referenceId: string) {
    setEntityQuery({ type: referenceType, id: referenceId });
    setView('history');
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="erp"
          icon={ScrollText}
          title="Bitácora · Event Ledger"
          subtitle="Registro inmutable de todo lo que pasa en el piso — auditable y rastreable"
        />

        {/* Selector de lente */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`${glass} inline-flex items-center gap-1 p-1 rounded-2xl`}>
            <ViewBtn active={view === 'timeline'} onClick={() => setView('timeline')} icon={<ListTree className="h-4 w-4" />}>
              Línea de tiempo
            </ViewBtn>
            <ViewBtn active={view === 'history'} onClick={() => setView('history')} icon={<History className="h-4 w-4" />}>
              Historial por entidad
            </ViewBtn>
          </div>
        </div>

        {view === 'timeline' ? (
          <TimelineView onPickReference={pickReference} />
        ) : (
          <EntityHistoryView query={entityQuery} onQuery={setEntityQuery} />
        )}
      </main>

      {/* Estilo compartido de inputs/selects para ambas lentes. */}
      <style jsx global>{`
        .al-input {
          border-radius: 0.75rem;
          padding: 0.45rem 0.7rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.8125rem;
          color: inherit;
        }
        .al-input:focus {
          border-color: ${ACCENT};
        }
        :global(.dark) .al-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-white text-black shadow-sm dark:bg-white/15 dark:text-white' : 'text-gray-500 hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
