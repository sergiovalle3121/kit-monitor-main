import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-receiving-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receiving-center.component.html',
  styleUrl: './receiving-center.component.css'
})
export class ReceivingCenterComponent implements OnInit {
  loading = true;
  events: any[] = [];
  suppliers: any[] = [];
  showModal = false;

  receiptForm = {
    partNumber: '',
    supplierCode: '',
    lotNumber: '',
    serialNumber: '',
    quantity: 0,
    warehouseId: 'WH-MAIN',
    location: 'DOCK-A',
    poNumber: '',
    receivedBy: 'Warehouse Operator'
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadEvents();
    this.loadSuppliers();
  }

  loadEvents() {
    this.loading = true;
    this.api.getReceivingEvents().subscribe({
      next: (data) => {
        this.events = data;
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

  saveReceipt() {
    this.api.recordReceipt(this.receiptForm).subscribe({
      next: () => {
        this.loadEvents();
        this.showModal = false;
        this.receiptForm = { partNumber: '', supplierCode: '', lotNumber: '', serialNumber: '', quantity: 0, warehouseId: 'WH-MAIN', location: 'DOCK-A', poNumber: '', receivedBy: 'Warehouse Operator' };
      }
    });
  }
}
