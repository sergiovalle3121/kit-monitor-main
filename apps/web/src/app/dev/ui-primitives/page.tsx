'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { MoreHorizontal, Settings, Trash2 } from 'lucide-react';
import {
  Modal,
  Collapsible,
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from '@/components/ui';

/**
 * Banco de pruebas de los primitivos de UI compartidos (Modal, Collapsible,
 * DropdownMenu, Card). Es la superficie que ejercita `e2e/primitives.spec.ts`.
 *
 * Sólo en desarrollo: en producción devuelve 404 para no exponer una ruta de QA.
 */
export default function UiPrimitivesPlayground() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <h1 className="text-xl font-semibold text-foreground">Primitivos de UI — banco de pruebas</h1>

      {/* Modal */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Modal</h2>
        <button
          type="button"
          data-testid="demo-modal-open"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Abrir modal
        </button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modal de prueba"
          description="Debe cerrarse con Esc, click-fuera y el botón de cerrar."
          data-testid="demo-modal"
          footer={
            <button
              type="button"
              data-testid="demo-modal-footer-close"
              onClick={() => setModalOpen(false)}
              className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground"
            >
              Cerrar
            </button>
          }
        >
          <div className="space-y-3">
            {Array.from({ length: 30 }, (_, i) => (
              <p key={i} className="text-sm text-foreground">
                Línea de contenido {i + 1} — el cuerpo hace scroll interno sin empujar el header
                ni el footer fuera del viewport.
              </p>
            ))}
          </div>
        </Modal>
      </section>

      {/* Collapsible */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Collapsible</h2>
        <Collapsible title="Sección colapsable" icon={<Settings className="h-4 w-4" />} data-testid="demo-collapsible">
          <p data-testid="demo-collapsible-body" className="text-sm text-foreground">
            Contenido revelado al expandir. La altura se anima de forma consistente.
          </p>
        </Collapsible>
      </section>

      {/* DropdownMenu */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">DropdownMenu</h2>
        <DropdownMenu
          data-testid="demo-dropdown"
          align="start"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" /> Acciones
            </button>
          }
        >
          <DropdownItem icon={<Settings className="h-4 w-4" />} data-testid="demo-dropdown-item">
            Configurar
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem destructive icon={<Trash2 className="h-4 w-4" />}>
            Eliminar
          </DropdownItem>
        </DropdownMenu>
      </section>

      {/* Card */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Card</h2>
        <Card data-testid="demo-card">
          <CardHeader>
            <CardTitle>Tarjeta consistente</CardTitle>
            <CardDescription>Fondo opaco y borde tematizados (claro/oscuro).</CardDescription>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-foreground">Cuerpo de la tarjeta.</p>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
