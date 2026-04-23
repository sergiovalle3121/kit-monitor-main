import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-iqc-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './iqc-center.component.html',
  styleUrl: './iqc-center.component.css'
})
export class IqcCenterComponent implements OnInit {
  loading = true;
  inspections: any[] = [];
  suppliers: any[] = [];
  showModal = false;

  inspectionForm = {
    partNumber: '',
    supplierId: null,
    lotNumber: '',
    result: 'pass' as any,
    sampleSize: 0,
    defectsFound: 0,
    inspector: 'QA Inspector',
    notes: '',
    warehouseId: 'WH-RECEIVING'
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadInspections();
    this.loadSuppliers();
  }

  loadInspections() {
    this.loading = true;
    this.api.getIqcInspections().subscribe({
      next: (data) => {
        this.inspections = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  loadSuppliers() {
    this.api.getSuppliers().subscribe({
      next: (data) => this.suppliers = data
    });
  }

  openCreate() {
    this.showModal = true;
  }

  saveInspection() {
    this.api.recordIqcInspection(this.inspectionForm).subscribe({
      next: () => {
        this.loadInspections();
        this.showModal = false;
        this.inspectionForm = { partNumber: '', supplierId: null, lotNumber: '', result: 'pass', sampleSize: 0, defectsFound: 0, inspector: 'QA Inspector', notes: '', warehouseId: 'WH-RECEIVING' };
      }
    });
  }

  getResultClass(result: string) {
    return result.toLowerCase();
  }
}
