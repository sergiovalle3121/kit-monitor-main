import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-scar-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scar-center.component.html',
  styleUrl: './scar-center.component.css'
})
export class ScarCenterComponent implements OnInit {
  loading = true;
  scars: any[] = [];
  suppliers: any[] = [];
  selectedScar: any = null;
  showCreateModal = false;
  showDetailModal = false;

  scarForm = {
    supplierId: null,
    partNumber: '',
    severity: 'major',
    issueSummary: '',
    defectDescription: '',
    quantityAffected: 0,
    internalOwner: '',
    supplierContact: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadScars();
    this.loadSuppliers();
  }

  loadScars() {
    this.loading = true;
    this.api.getScars().subscribe({
      next: (data) => {
        this.scars = data;
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
    this.showCreateModal = true;
  }

  createScar() {
    const supplier = this.suppliers.find(s => s.id == this.scarForm.supplierId);
    this.api.createScar({
      ...this.scarForm,
      supplier,
      createdBy: 'QA Manager'
    }).subscribe({
      next: () => {
        this.loadScars();
        this.showCreateModal = false;
        this.scarForm = { supplierId: null, partNumber: '', severity: 'major', issueSummary: '', defectDescription: '', quantityAffected: 0, internalOwner: '', supplierContact: '' };
      }
    });
  }

  viewDetail(scar: any) {
    this.selectedScar = { ...scar };
    this.showDetailModal = true;
  }

  updateScar() {
    if (!this.selectedScar) return;
    this.api.updateScar(this.selectedScar.id, this.selectedScar, 'QA Engineer').subscribe({
      next: () => {
        this.loadScars();
        this.showDetailModal = false;
      }
    });
  }

  getStatusClass(status: string) {
    return status.toLowerCase().replace(/ /g, '_');
  }
}
