import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-kits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kits.html',
  styleUrls: ['./kits.css'],
})
export class KitsComponent implements OnInit, OnDestroy {
  kits: any[] = [];
  plans: any[] = [];
  loading = false;
  error: string | null = null;

  showForm = false;
  selectedPlanId: number | null = null;
  creating = false;
  createError: string | null = null;

  expandedKitId: number | null = null;

  advanceDelta: Record<number, number | null> = {};
  advanceNotes: Record<number, string> = {};
  advancingKitId: number | null = null;
  advanceError: Record<number, string> = {};

  resupplyQty: Record<number, number | null> = {};
  resupplyingMaterialId: number | null = null;
  resupplyError: Record<number, string> = {};

  exceptionType: Record<number, string> = {};
  exceptionDesc: Record<number, string> = {};
  reportingKitId: number | null = null;
  exceptionError: Record<number, string> = {};

  materialActual: Record<number, number | null> = {};
  materialBulk: Record<number, boolean> = {};
  materialError: Record<number, string> = {};
  savingMaterialId: number | null = null;

  startingKitId: number | null = null;
  exportKitId: number | null = null;

  now = Date.now();
  private timerId: number | null = null;
  private bomCatalogByModel = new Map<string, Map<string, any>>();
  pendingCancellationByKitId: Record<number, any> = {};
  respondingCancellationId: number | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadKits();
    this.loadPlans();
    this.timerId = window.setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
  }

  loadPlans(): void {
    this.api.getPlans().subscribe({ next: (data) => (this.plans = data ?? []) });
  }

  loadKits(): void {
    this.loading = true;
    this.error = null;

    this.api.getKits().pipe(
      switchMap((kits) => {
        const safeKits = kits ?? [];
        const models = [...new Set(
          safeKits.map((kit) => kit.plan?.model).filter((model): model is string => !!model),
        )];

        if (!models.length) {
          return this.api.getPendingCancellationRequests().pipe(
            map((pendingRequests) => ({
              kits: safeKits,
              catalogs: [] as Array<{ model: string; rows: any[] }>,
              pendingRequests: pendingRequests ?? [],
            })),
          );
        }

        return forkJoin(
          models.map((modelName) =>
            this.api.getBom(modelName).pipe(
              map((rows) => ({ model: modelName, rows: rows ?? [] })),
            ),
          ),
        ).pipe(switchMap((catalogs) =>
          this.api.getPendingCancellationRequests().pipe(
            map((pendingRequests) => ({ kits: safeKits, catalogs, pendingRequests: pendingRequests ?? [] })),
          ),
        ),
        );
      }),
    ).subscribe({
      next: ({ kits, catalogs, pendingRequests }) => {
        this.setCatalogs(catalogs);
        this.kits = this.decorateKits(kits);
        this.pendingCancellationByKitId = (pendingRequests ?? []).reduce((acc: Record<number, any>, request: any) => {
          const kitId = Number(request?.kit?.id ?? request?.kitId ?? 0);
          if (kitId > 0) acc[kitId] = request;
          return acc;
        }, {});
        this.bootstrapMaterialDrafts();
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los kits';
        this.loading = false;
      },
    });
  }

  createKit(): void {
    if (!this.selectedPlanId) return;

    this.creating = true;
    this.createError = null;

    this.api.createKit(this.selectedPlanId).subscribe({
      next: (kit) => {
        const decorated = this.decorateKit(kit);
        this.kits = [decorated, ...this.kits];
        this.bootstrapMaterialDrafts();
        this.creating = false;
        this.showForm = false;
        this.selectedPlanId = null;
        this.expandedKitId = decorated.id;
        this.loadPlans();
      },
      error: (err) => {
        this.createError = err?.error?.message ?? 'Error al crear el kit';
        this.creating = false;
      },
    });
  }

  takeKit(kit: any): void {
    if (this.startingKitId !== null) return;

    const printWindow = window.open('', '_blank');
    this.startingKitId = kit.id;
    this.error = null;

    this.api.startKit(kit.id).subscribe({
      next: (updated) => {
        const decorated = this.decorateKit(updated);
        this.upsertKit(decorated);
        this.bootstrapMaterialDrafts();
        this.startingKitId = null;
        this.printKitSheet(decorated, printWindow, true);
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudo iniciar el surtido del kit';
        this.startingKitId = null;
        printWindow?.close();
      },
    });
  }

  exportPdf(kit: any): void {
    this.exportKitId = kit.id;
    this.printKitSheet(kit, undefined, true);
    window.setTimeout(() => {
      this.exportKitId = null;
    }, 300);
  }

  exportExcel(kit: any): void {
    const rows = this.materialRowsForDocument(kit).map((material) => [
      kit.plan?.workOrder ?? '',
      kit.plan?.model ?? '',
      `BK${kit.plan?.line ?? ''}`,
      material.location,
      material.partNumber,
      material.description,
      material.quantityRequired,
      material.quantityActual ?? '',
      material.isBulkResupply ? 'Volumen / resurtido' : 'Exacto',
      material.unit,
    ]);

    const csv = [
      ['Folio', 'Modelo', 'Backen', 'Localidad', 'NP', 'Descripcion', 'Cantidad requerida', 'Cantidad kitteada', 'Modo', 'Unidad'],
      ...rows,
    ].map((row) => row.map((value) => this.escapeCsv(value)).join(',')).join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${kit.plan?.workOrder ?? 'kit'}-${kit.plan?.model ?? 'bom'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  saveMaterial(_kit: any, material: any): void {
    const bulk = !!this.materialBulk[material.id];
    const draft = this.materialActual[material.id];

    if (!bulk && (draft === null || draft === undefined || draft < 0)) {
      this.materialError[material.id] = 'Captura una cantidad valida o marca volumen.';
      return;
    }

    this.savingMaterialId = material.id;
    this.materialError[material.id] = '';

    this.api.updateKitMaterial(material.id, {
      quantityActual: bulk ? null : Number(draft),
      isBulkResupply: bulk,
    }).subscribe({
      next: (updated) => {
        material.quantityActual = updated.quantityActual;
        material.isBulkResupply = updated.isBulkResupply;
        this.materialActual[material.id] = updated.quantityActual ?? material.quantityRequired;
        this.materialBulk[material.id] = !!updated.isBulkResupply;
        this.savingMaterialId = null;
      },
      error: (err) => {
        this.materialError[material.id] = err?.error?.message ?? 'No se pudo guardar la captura';
        this.savingMaterialId = null;
      },
    });
  }

  registerAdvance(kit: any): void {
    const delta = this.advanceDelta[kit.id];
    if (!delta || delta <= 0) return;

    this.advancingKitId = kit.id;
    this.advanceError[kit.id] = '';

    this.api.createAdvance(kit.id, delta, this.advanceNotes[kit.id]).subscribe({
      next: (result) => {
        const idx = this.kits.findIndex((item) => item.id === kit.id);
        if (idx >= 0) {
          this.kits[idx].totalCompleted = result.totalCompleted;
          this.kits[idx].status = result.kitStatus;
          this.loadKits();
        }
        this.advanceDelta[kit.id] = null;
        this.advanceNotes[kit.id] = '';
        this.advancingKitId = null;
      },
      error: (err) => {
        this.advanceError[kit.id] = err?.error?.message ?? 'Error al registrar avance';
        this.advancingKitId = null;
      },
    });
  }

  toggleExpand(kitId: number): void {
    this.expandedKitId = this.expandedKitId === kitId ? null : kitId;
  }

  plansWithoutKit(): any[] {
    const usedPlanIds = new Set(this.kits.map((kit) => kit.plan?.id));
    return this.plans.filter((plan) => !usedPlanIds.has(plan.id));
  }

  maxAdvance(kit: any): number {
    return (kit.plan?.quantity ?? 0) - (kit.totalCompleted ?? 0);
  }

  reportException(kit: any): void {
    const type = this.exceptionType[kit.id];
    const desc = this.exceptionDesc[kit.id];
    if (!type || !desc?.trim()) return;

    this.reportingKitId = kit.id;
    this.exceptionError[kit.id] = '';

    this.api.createException(kit.id, type, desc.trim()).subscribe({
      next: () => {
        this.exceptionType[kit.id] = '';
        this.exceptionDesc[kit.id] = '';
        this.reportingKitId = null;
        this.loadKits();
      },
      error: (err) => {
        this.exceptionError[kit.id] = err?.error?.message ?? 'Error al reportar';
        this.reportingKitId = null;
      },
    });
  }

  resolveException(exception: any, kit: any): void {
    this.api.resolveException(exception.id).subscribe({
      next: () => this.loadKits(),
      error: () => {
        this.exceptionError[kit.id] = 'No se pudo resolver la incidencia';
      },
    });
  }

  pendingCancellation(kit: any): any | null {
    return this.pendingCancellationByKitId[kit.id] ?? null;
  }

  cancellationCountdownLabel(kit: any): string {
    const request = this.pendingCancellation(kit);
    if (!request?.expiresAt) return 'Expira pronto';
    const diff = Math.max(0, new Date(request.expiresAt).getTime() - this.now);
    const minutes = Math.floor(diff / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    return `Expira en ${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  respondCancellationRequest(kit: any, action: 'accept' | 'reject'): void {
    const request = this.pendingCancellation(kit);
    if (!request || this.respondingCancellationId !== null) return;
    this.respondingCancellationId = request.id;
    this.api.respondCancellationRequest(request.id, action, 'kitteador').subscribe({
      next: () => {
        this.respondingCancellationId = null;
        this.loadKits();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudo responder la solicitud de cancelación';
        this.respondingCancellationId = null;
      },
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      preparing: 'Preparando',
      prepared: 'Armado',
      kitted: 'Armado',
      ready: 'Listo',
      requested: 'Solicitado',
      delivered: 'Entregado',
      sent: 'Enviado',
      received: 'Recibido',
      in_progress: 'En proceso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] ?? status;
  }

  materialTypeLabel(material: any): 'Exacto' | 'Volumen' {
    return this.materialBulk[material.id] || material.isBulkResupply ? 'Volumen' : 'Exacto';
  }

  materialDelta(material: any): number {
    const planned = Number(material.quantityRequired ?? 0);
    const physical = Number(this.materialActual[material.id] ?? material.quantityActual ?? 0);
    return Math.round((physical - planned) * 100) / 100;
  }

  materialStatusLabel(material: any): string {
    const delta = this.materialDelta(material);
    const isVolume = this.materialTypeLabel(material) === 'Volumen';

    if (isVolume) return delta < 0 ? 'Resurtir' : 'Suficiente';
    if (delta === 0) return '✓ OK';
    return delta < 0 ? 'Faltante' : 'Exceso';
  }

  materialStatusClass(material: any): string {
    const delta = this.materialDelta(material);
    const isVolume = this.materialTypeLabel(material) === 'Volumen';

    if (isVolume) return delta < 0 ? 'st-volume-resupply' : 'st-ok';
    if (delta === 0) return 'st-ok';
    return delta < 0 ? 'st-missing' : 'st-excess';
  }

  needsStart(kit: any): boolean {
    return this.workflowStatusForAction(kit.status) === 'preparing' && !kit.preparedAt;
  }

  nextAction(kit: any): { label: string; status: string; style: string } | null {
    const status = this.workflowStatusForAction(kit.status);
    if (status === 'preparing' && !kit.preparedAt) return null;

    const map: Record<string, { label: string; status: string; style: string }> = {
      preparing: { label: 'Marcar como armado', status: 'kitted', style: 'btn-flow flow-kitted' },
      kitted: { label: 'Marcar listo', status: 'ready', style: 'btn-flow flow-ready' },
      ready: { label: 'Solicitar kit', status: 'requested', style: 'btn-flow flow-requested' },
      requested: { label: 'Confirmar entrega', status: 'delivered', style: 'btn-flow flow-delivered' },
    };
    return map[status] ?? null;
  }

  canAdvance(kit: any): boolean {
    const status = this.workflowStatusForAdvance(kit.status);
    return status === 'delivered' || status === 'in_progress' || status === 'received';
  }

  transitionKit(kit: any, newStatus: string): void {
    this.api.updateKitStatus(kit.id, newStatus).subscribe({
      next: () => {
        this.loadKits();
        this.loadPlans();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error al cambiar estado';
      },
    });
  }

  registerResupply(kit: any, material: any): void {
    const qty = this.resupplyQty[material.id];
    if (!qty || qty <= 0) return;

    this.resupplyingMaterialId = material.id;
    this.resupplyError[material.id] = '';

    this.api.createResupply(kit.id, material.partNumber, qty).subscribe({
      next: (resupply) => {
        this.api.deliverResupply(resupply.id, qty).subscribe({
          next: () => {
            this.resupplyQty[material.id] = null;
            this.resupplyingMaterialId = null;
            this.loadKits();
          },
          error: (err) => {
            this.resupplyError[material.id] = err?.error?.message ?? 'Error al entregar resurtido';
            this.resupplyingMaterialId = null;
          },
        });
      },
      error: (err) => {
        this.resupplyError[material.id] = err?.error?.message ?? 'Error al crear resurtido';
        this.resupplyingMaterialId = null;
      },
    });
  }

  agingLabel(kit: any): string {
    if (!kit.preparedAt) return 'Sin iniciar';
    return this.formatDuration(kit.preparedAt, kit.kittedAt);
  }

  agingStatusLabel(kit: any): string {
    if (!kit.preparedAt) return 'Pendiente de surtido';
    if (kit.kittedAt) return 'Surtido cerrado';
    return 'En armado';
  }

  trackByKitId(_index: number, kit: any): number {
    return kit.id;
  }

  trackByMaterialId(_index: number, material: any): number {
    return material.id;
  }

  private workflowStatusForAction(status: string): string {
    if (status === 'prepared') return 'preparing';
    if (status === 'sent') return 'requested';
    return status;
  }

  private workflowStatusForAdvance(status: string): string {
    if (status === 'sent') return 'delivered';
    return status;
  }

  private setCatalogs(catalogs: Array<{ model: string; rows: any[] }>): void {
    this.bomCatalogByModel = new Map(
      catalogs.map((entry) => [
        entry.model,
        new Map(entry.rows.map((item) => [item.partNumber, item] as const)),
      ]),
    );
  }

  private decorateKits(kits: any[]): any[] {
    return kits.map((kit) => this.decorateKit(kit));
  }

  private decorateKit(kit: any): any {
    const catalog = this.bomCatalogByModel.get(kit.plan?.model ?? '') ?? new Map<string, any>();
    const materials = [...(kit.materials ?? [])]
      .map((material) => {
        const catalogItem = catalog.get(material.partNumber);
        return {
          ...material,
          description: material.description || catalogItem?.description || 'Sin descripcion',
          location: catalogItem?.location || 'Sin ubicacion',
        };
      })
      .sort((left, right) => this.compareMaterials(left, right));

    return {
      ...kit,
      materials,
    };
  }

  private compareMaterials(left: any, right: any): number {
    const locationDiff = String(left.location ?? '').localeCompare(String(right.location ?? ''));
    if (locationDiff !== 0) return locationDiff;
    return String(left.partNumber ?? '').localeCompare(String(right.partNumber ?? ''));
  }

  private bootstrapMaterialDrafts(): void {
    this.materialActual = {};
    this.materialBulk = {};
    for (const kit of this.kits) {
      for (const material of kit.materials ?? []) {
        this.materialActual[material.id] = material.quantityActual ?? material.quantityRequired;
        this.materialBulk[material.id] = !!material.isBulkResupply;
      }
    }
  }

  private upsertKit(updated: any): void {
    const decorated = this.decorateKit(updated);
    const index = this.kits.findIndex((kit) => kit.id === decorated.id);
    if (index >= 0) {
      this.kits[index] = decorated;
    } else {
      this.kits = [decorated, ...this.kits];
    }
    this.expandedKitId = decorated.id;
  }

  private materialRowsForDocument(kit: any): any[] {
    return [...(kit.materials ?? [])].sort((left, right) => this.compareMaterials(left, right));
  }

  private printKitSheet(kit: any, targetWindow?: Window | null, autoPrint = false): void {
    const popup = targetWindow ?? window.open('', '_blank');
    if (!popup) return;

    const generatedAt = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());

    const materialRows = this.materialRowsForDocument(kit).map((material) => `
      <tr>
        <td>${this.escapeHtml(material.location || 'Sin ubicacion')}</td>
        <td>${this.escapeHtml(material.partNumber)}</td>
        <td>${this.escapeHtml(material.description || 'Sin descripcion')}</td>
        <td class="num">${this.escapeHtml(String(material.quantityRequired ?? 0))}</td>
        <td class="num">${material.quantityActual === null || material.quantityActual === undefined ? '' : this.escapeHtml(String(material.quantityActual))}</td>
        <td>${material.isBulkResupply ? 'Volumen / resurtido' : 'Exacto'}</td>
        <td>${this.escapeHtml(material.unit || 'EA')}</td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Kit ${this.escapeHtml(kit.plan?.workOrder ?? '')}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: "Segoe UI", Tahoma, sans-serif;
              color: #0f172a;
              background: #eef4fb;
            }
            .sheet {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              padding: 18mm 16mm;
              background: white;
            }
            .hero {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              padding: 18px 22px;
              border-radius: 24px;
              background: linear-gradient(135deg, #0f172a, #2563eb);
              color: white;
            }
            .hero h1 {
              margin: 0 0 10px;
              font-size: 30px;
              line-height: 1;
            }
            .hero p {
              margin: 0;
              color: rgba(219, 234, 254, 0.88);
              font-size: 14px;
            }
            .folio {
              min-width: 180px;
              padding: 14px 16px;
              border-radius: 18px;
              background: rgba(255, 255, 255, 0.12);
              border: 1px solid rgba(255, 255, 255, 0.15);
            }
            .folio span,
            .folio strong,
            .folio small {
              display: block;
            }
            .folio span {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.16em;
              color: rgba(219, 234, 254, 0.78);
            }
            .folio strong {
              margin: 10px 0 8px;
              font-size: 26px;
            }
            .folio small {
              color: rgba(219, 234, 254, 0.84);
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 12px;
              margin: 20px 0 18px;
            }
            .summary-card {
              padding: 12px 14px;
              border-radius: 18px;
              background: #f8fafc;
              border: 1px solid #dbeafe;
            }
            .summary-card span,
            .summary-card strong {
              display: block;
            }
            .summary-card span {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #64748b;
            }
            .summary-card strong {
              margin-top: 6px;
              font-size: 21px;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 16px;
              color: #475569;
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            thead th {
              padding: 11px 10px;
              text-align: left;
              background: #e2e8f0;
              color: #334155;
              border-bottom: 2px solid #cbd5e1;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              font-size: 10px;
            }
            tbody td {
              padding: 10px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
            }
            tbody tr:nth-child(even) {
              background: #f8fafc;
            }
            .num {
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
            .footer {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 18px;
              margin-top: 26px;
            }
            .sign-box {
              min-height: 82px;
              padding: 14px 16px;
              border: 1px dashed #94a3b8;
              border-radius: 18px;
            }
            .sign-box span {
              display: block;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #64748b;
              margin-bottom: 26px;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <section class="hero">
              <div>
                <h1>Formato de surtido de kit</h1>
                <p>Documento operativo para recorrido de picking, conteo fisico y validacion de materiales.</p>
              </div>
              <div class="folio">
                <span>Folio</span>
                <strong>${this.escapeHtml(kit.plan?.workOrder ?? '')}</strong>
                <small>${this.escapeHtml(kit.plan?.model ?? '')}</small>
              </div>
            </section>

            <section class="summary">
              <div class="summary-card"><span>Modelo</span><strong>${this.escapeHtml(kit.plan?.model ?? '')}</strong></div>
              <div class="summary-card"><span>Backen</span><strong>BK${this.escapeHtml(String(kit.plan?.line ?? ''))}</strong></div>
              <div class="summary-card"><span>Cantidad</span><strong>${this.escapeHtml(String(kit.plan?.quantity ?? 0))}</strong></div>
              <div class="summary-card"><span>Turno</span><strong>${this.escapeHtml(kit.plan?.shift ?? '')}</strong></div>
              <div class="summary-card"><span>Materiales</span><strong>${this.escapeHtml(String(kit.materials?.length ?? 0))}</strong></div>
            </section>

            <div class="meta-bar">
              <span>Generado: ${this.escapeHtml(generatedAt)}</span>
              <span>Estatus kit: ${this.escapeHtml(this.statusLabel(kit.status))}</span>
              <span>Aging surtido: ${this.escapeHtml(this.agingLabel(kit))}</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Localidad</th>
                  <th>NP</th>
                  <th>Descripcion</th>
                  <th>Cantidad requerida</th>
                  <th>Conteo / kitteado</th>
                  <th>Modo</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>${materialRows}</tbody>
            </table>

            <section class="footer">
              <div class="sign-box">
                <span>Preparado por</span>
              </div>
              <div class="sign-box">
                <span>Validado por</span>
              </div>
            </section>
          </main>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    if (autoPrint) {
      popup.onload = () => popup.print();
    }
  }

  private formatDuration(startValue: string | Date, endValue?: string | Date | null): string {
    const start = new Date(startValue).getTime();
    const end = endValue ? new Date(endValue).getTime() : this.now;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'Sin dato';

    const totalSeconds = Math.floor((end - start) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private escapeCsv(value: any): string {
    const normalized = String(value ?? '').replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private escapeHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
