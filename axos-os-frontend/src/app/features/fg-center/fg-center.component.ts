import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-fg-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fg-center.component.html',
  styleUrl: './fg-center.component.css'
})
export class FgCenterComponent implements OnInit {
  loading = true;
  wipList: any[] = [];
  showDeclareModal = false;
  selectedWip: any = null;
  declareQty = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.getProductionWip().subscribe({
      next: (data) => {
        this.wipList = data.filter((w: any) => w.completedQty > 0);
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  openDeclare(wip: any) {
    this.selectedWip = wip;
    this.declareQty = wip.completedQty;
    this.showDeclareModal = true;
  }

  confirmDeclaration() {
    if (!this.selectedWip) return;
    this.api.declareFinishedGoods(this.selectedWip.kit.id, {
      quantity: this.declareQty,
      actor: 'Line Supervisor 01'
    }).subscribe(() => {
      this.showDeclareModal = false;
      this.loadData();
    });
  }
}
