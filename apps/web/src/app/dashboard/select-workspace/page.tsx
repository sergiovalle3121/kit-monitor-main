'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Building2, Briefcase, ArrowRight, AlertCircle } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * Pantalla "selector de contexto" estilo Slack/GitHub: el usuario elige
 * Edificio + Proyecto y a partir de ahí el resto del dashboard se filtra
 * por ese contexto (vía X-Building-Id / X-Project-Id en cada request).
 */
export default function SelectWorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SelectWorkspaceInner />
    </Suspense>
  );
}

function SelectWorkspaceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations('selectWorkspace');
  const next = params.get('next') || '/dashboard';
  const { user } = useAuth();
  const {
    buildings,
    projects,
    buildingId: ctxBuildingId,
    projectId: ctxProjectId,
    isLoading,
    error,
    setWorkspace,
  } = useWorkspace();

  // Selección manual del usuario; null = aún no ha elegido en esta vista.
  const [pickedBuildingId, setPickedBuildingId] = useState<string | null>(ctxBuildingId);
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(ctxProjectId);

  // Selección efectiva: lo que eligió el usuario, o autoselección si solo hay uno.
  const buildingId =
    pickedBuildingId ?? (buildings.length === 1 ? buildings[0].id : null);
  const projectId =
    pickedProjectId ?? (projects.length === 1 ? projects[0].id : null);

  const visibleProjects = useMemo(() => {
    // Filtrar proyectos por edificio dedicado si aplica.
    if (!buildingId) return projects;
    return projects.filter((p) => !p.dedicatedBuilding?.id || p.dedicatedBuilding.id === buildingId);
  }, [projects, buildingId]);

  function enter() {
    setWorkspace({ buildingId, projectId });
    router.push(next);
    router.refresh();
  }

  const canEnter = Boolean(buildingId || projectId);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`${glass} rounded-[28px] p-8 md:p-10`}
        >
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('eyebrow')}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {user?.email
                ? t('greetingNamed', { name: user.email.split('@')[0] })
                : t('greetingPlain')}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </header>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('loadError')}</span>
            </div>
          )}

          {/* Edificios */}
          <Section title={t('building')} icon={Building2}>
            {isLoading ? (
              <Skeleton />
            ) : buildings.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noBuildings')}</p>
            ) : (
              <OptionGrid
                options={buildings.map((b) => ({
                  id: b.id,
                  title: b.name,
                  subtitle: b.code,
                }))}
                selectedId={buildingId}
                onPick={setPickedBuildingId}
              />
            )}
          </Section>

          {/* Proyectos */}
          <Section title={t('project')} icon={Briefcase}>
            {isLoading ? (
              <Skeleton />
            ) : visibleProjects.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noProjects')}</p>
            ) : (
              <OptionGrid
                options={visibleProjects.map((p) => ({
                  id: p.id,
                  title: p.name,
                  subtitle: p.customer?.name || p.code,
                }))}
                selectedId={projectId}
                onPick={setPickedProjectId}
              />
            )}
          </Section>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => {
                setWorkspace({ buildingId: null, projectId: null });
                router.push(next);
              }}
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              {t('continueWithout')}
            </button>
            <button
              onClick={enter}
              disabled={!canEnter}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
            >
              {t('enter')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function OptionGrid({
  options,
  selectedId,
  onPick,
}: {
  options: { id: string; title: string; subtitle?: string }[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const t = useTranslations('selectWorkspace');
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const active = opt.id === selectedId;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(opt.id)}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
              active
                ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-black/10 bg-black/5 hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{opt.title}</span>
              {opt.subtitle && (
                <span className="block truncate text-xs text-gray-500">{opt.subtitle}</span>
              )}
            </span>
            {active && (
              <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                {t('selected')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
      ))}
    </div>
  );
}
