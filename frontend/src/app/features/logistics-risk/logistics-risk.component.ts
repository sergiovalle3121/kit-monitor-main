import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';

interface LogisticsMovement {
  backendCode: string;
  destination: string;
  model: string;
  parts: string[];
  status: 'in_transit' | 'delivered';
  timestamp: string;
}

interface MaterialRiskItem {
  partNumber: string;
  severity: 'stable' | 'attention' | 'critical' | 'urgent';
  minutesToStockout: number | null;
  bayId: number;
  recommendation: string;
}

@Component({
  selector: 'app-logistics-risk',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logistics-risk.component.html',
  styleUrl: './logistics-risk.component.css',
})
export class LogisticsRiskComponent implements OnInit {
  movements: LogisticsMovement[] = [];
  materialRisks: MaterialRiskItem[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getLogisticsShortageRisk().subscribe({
      next: (rows) => this.buildView(rows ?? []),
      error: () => {
        this.movements = [];
        this.materialRisks = [];
      },
    });
  }

  get activeMovementsToday(): number {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.movements.filter((item) => item.status === 'in_transit' && new Date(item.timestamp).getTime() >= startOfDay.getTime()).length;
  }

  riskSignal(item: MaterialRiskItem): '🟢' | '🟡' | '🔴' {
    if (item.severity === 'stable') return '🟢';
    if (item.severity === 'attention') return '🟡';
    return '🔴';
  }

  riskLabel(item: MaterialRiskItem): string {
    if (item.severity === 'stable') return 'Sin riesgo';
    if (item.severity === 'attention') return 'Riesgo próximo';
    return 'Quiebre inminente';
  }

  timeToStockout(item: MaterialRiskItem): string {
    if (item.minutesToStockout == null) return 'Sin quiebre estimado';
    if (item.minutesToStockout <= 60) return `${Math.round(item.minutesToStockout)} min`;
    const hours = Math.floor(item.minutesToStockout / 60);
    const minutes = Math.round(item.minutesToStockout % 60);
    return `${hours}h ${minutes}m`;
  }

  private buildView(rows: any[]): void {
    this.movements = rows
      .map((row: any) => {
        const backend = row.backend ?? {};
        const riskMaterials = row.risk?.materials ?? [];
        const parts = riskMaterials
          .filter((material: any) => ['attention', 'critical', 'urgent'].includes(material.severity))
          .map((material: any) => material.partNumber)
          .slice(0, 5);

        const isDelivered = ['completed', 'delivered', 'received', 'sent'].includes(backend.status);

        return {
          backendCode: backend.backendCode ?? `BK${backend.backen ?? '-'}`,
          destination: backend.backen ? `BK${backend.backen}/Línea` : 'Línea',
          model: backend.model ?? 'N/A',
          parts,
          status: isDelivered ? 'delivered' : 'in_transit',
          timestamp: backend.receivedAt ?? backend.startedAt ?? new Date().toISOString(),
        } as LogisticsMovement;
      })
      .filter((item) => item.status === 'in_transit' || item.parts.length > 0);

    this.materialRisks = rows
      .flatMap((row: any) => (row.risk?.materials ?? []).map((material: any) => ({
        partNumber: material.partNumber,
        severity: material.severity,
        minutesToStockout: material.minutesToStockout,
        bayId: material.bayId,
        recommendation: this.recommendationFor(material),
      } as MaterialRiskItem)))
      .sort((left: MaterialRiskItem, right: MaterialRiskItem) => {
        const severityRank: Record<MaterialRiskItem['severity'], number> = { urgent: 3, critical: 2, attention: 1, stable: 0 };
        return severityRank[right.severity] - severityRank[left.severity];
      })
      .slice(0, 24);
  }

  private recommendationFor(material: any): string {
    if (material.severity === 'urgent') return `Reabastecer NP ${material.partNumber} en B${material.bayId} de inmediato.`;
    if (material.severity === 'critical') return `Priorizar surtido en ruta corta para B${material.bayId}.`;
    if (material.severity === 'attention') return `Programar reposición preventiva en siguiente corrida logística.`;
    return `Monitoreo normal, sin acción inmediata.`;
  }
}
