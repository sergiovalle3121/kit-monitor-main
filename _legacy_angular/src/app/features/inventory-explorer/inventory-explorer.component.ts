import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextService } from '../../core/enterprise-context.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';

@Component({
  selector: 'app-inventory-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, EnterpriseContextBannerComponent],
  templateUrl: './inventory-explorer.component.html',
  styleUrl: './inventory-explorer.component.css'
})
export class InventoryExplorerComponent implements OnInit {
  private api = inject(ApiService);
  private context = inject(EnterpriseContextService);

  loading = true;
  error = '';
  positions: any[] = [];
  movements: any[] = [];
  
  viewMode: 'stock' | 'movements' = 'stock';
  searchTerm = '';
  selectedWarehouse = '';
  
  warehouses: any[] = [];

  ngOnInit() {
    this.loadMasterData();
    this.loadInventory();
  }

  loadMasterData() {
    this.api.getEnterpriseWarehouses().subscribe({
      next: (whs) => this.warehouses = whs,
      error: () => console.error('Failed to load warehouses')
    });
  }

  loadInventory() {
    this.loading = true;
    const ctx = this.context.context();
    
    this.api.getInventoryPositions({
      partNumber: this.searchTerm,
      warehouseId: this.selectedWarehouse,
      programId: ctx.programId
    }).subscribe({
      next: (data) => {
        this.positions = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error cargando inventario';
        this.loading = false;
      }
    });

    this.api.getInventoryMovements({
      partNumber: this.searchTerm,
      warehouseId: this.selectedWarehouse
    }).subscribe({
      next: (data) => this.movements = data
    });
  }

  onSearch() {
    this.loadInventory();
  }

  getWarehouseName(id: string) {
    return this.warehouses.find(w => w.id === id)?.name || id;
  }

  statusClass(status: string) {
    return {
      'available': 'status-ok',
      'hold': 'status-warn',
      'quarantine': 'status-critical',
      'expired': 'status-critical'
    }[status] || '';
  }

  // Demo helper to receive material
  quickReceive() {
    const pn = prompt('Part Number a recibir:');
    if (!pn) return;
    const qty = Number(prompt('Cantidad:'));
    if (isNaN(qty) || qty <= 0) return;
    
    const wh = this.selectedWarehouse || (this.warehouses.length ? this.warehouses[0].id : 'WH-CENTRAL');

    this.api.recordInventoryTransaction({
      type: 'RECEIVE',
      partNumber: pn,
      quantity: qty,
      toWarehouseId: wh,
      actorName: 'AXOS Admin',
      reason: 'Carga inicial / Recepción manual'
    }).subscribe({
      next: () => this.loadInventory(),
      error: (err) => alert('Error: ' + (err.error?.message || 'No se pudo recibir'))
    });
  }
}
