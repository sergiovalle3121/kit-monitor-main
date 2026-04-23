import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-shipping-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipping-center.component.html',
  styleUrl: './shipping-center.component.css'
})
export class ShippingCenterComponent implements OnInit {
  loading = true;
  shipments: any[] = [];
  fgInventory: any[] = [];
  showCreateModal = false;
  showStagingModal = false;
  selectedShipment: any = null;

  newShipment = {
    customer: '',
    carrier: '',
    scheduledAt: ''
  };

  stagingForm = {
    partNumber: '',
    quantity: 0,
    lotNumber: '',
    fromLocation: 'STAGING'
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.getShipments().subscribe(data => this.shipments = data);
    this.api.getInventoryPositions({ warehouseId: 'WH-FG' }).subscribe(data => {
      this.fgInventory = data.filter((p: any) => p.holdStatus === 'available' && p.onHand > 0);
      this.loading = false;
    });
  }

  createShipment() {
    this.api.createShipment(this.newShipment).subscribe(() => {
      this.showCreateModal = false;
      this.loadData();
    });
  }

  openStaging(shipment: any) {
    this.selectedShipment = shipment;
    this.showStagingModal = true;
  }

  stageItem() {
    this.api.addShipmentItem(this.selectedShipment.id, {
      ...this.stagingForm,
      fromWarehouseId: 'WH-FG'
    }).subscribe(() => {
      this.showStagingModal = false;
      this.loadData();
    });
  }

  dispatch(id: number) {
    this.api.dispatchShipment(id, 'Shipping Agent 01').subscribe(() => this.loadData());
  }

  getStatusClass(status: string) {
    return status.toLowerCase();
  }
}
