import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-oqc-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './oqc-center.component.html',
  styleUrl: './oqc-center.component.css'
})
export class OqcCenterComponent implements OnInit {
  loading = true;
  backlog: any[] = [];
  history: any[] = [];
  selectedItem: any = null;
  showInspectionModal = false;

  inspectionForm = {
    workOrder: '',
    partNumber: '',
    quantityInspected: 0,
    quantityPassed: 0,
    quantityFailed: 0,
    result: 'PASS',
    defectType: '',
    defectDescription: '',
    inspector: 'QA Inspector 01',
    notes: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.getOqcBacklog().subscribe(data => {
      this.backlog = data;
      this.loading = false;
    });
    this.api.getOqcHistory().subscribe(data => this.history = data);
  }

  openInspection(item: any) {
    this.selectedItem = item;
    this.inspectionForm.workOrder = item.lotNumber || 'N/A'; // Using lot as reference if WO not directly in position
    this.inspectionForm.partNumber = item.partNumber;
    this.inspectionForm.quantityInspected = item.onHand;
    this.inspectionForm.quantityPassed = item.onHand;
    this.inspectionForm.quantityFailed = 0;
    this.showInspectionModal = true;
  }

  submitInspection() {
    this.api.recordOqcInspection(this.inspectionForm).subscribe(() => {
      this.showInspectionModal = false;
      this.loadData();
    });
  }

  getResultClass(result: string) {
    return result.toLowerCase();
  }
}
