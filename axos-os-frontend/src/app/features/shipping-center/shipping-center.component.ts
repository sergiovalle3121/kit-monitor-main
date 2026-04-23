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
  releasedFg: any[] = [];
  showCreateModal = false;
  showStagingModal = false;
  showManifestModal = false;
  selectedShipment: any = null;

  newShipment = { customer: '', scheduledAt: '' };
  manifestForm = { carrier: '', truckPlate: '', driverName: '', dockNumber: '' };
  stagingForm = { partNumber: '', quantity: 0, fromLocation: 'STAGING' };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.getShipments().subscribe(data => this.shipments = data);
    this.api.getInventoryPositions({ warehouseId: 'WH-FG', holdStatus: 'available' }).subscribe(data => {
      this.releasedFg = data.filter((p: any) => p.onHand > 0);
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
    this.api.addShipmentItem(this.selectedShipment.id, this.stagingForm).subscribe(() => {
      this.showStagingModal = false;
      this.loadData();
    }, (err) => {
      alert(err.error?.message || 'Error staging item');
    });
  }

  generatePL(id: number) {
    this.api.generatePackingList(id, 'Shipping Supervisor 01').subscribe(() => this.loadData());
  }

  openLoading(shipment: any) {
    this.selectedShipment = shipment;
    this.showManifestModal = true;
  }

  confirmLoading() {
    this.api.startLoading(this.selectedShipment.id, this.manifestForm).subscribe(() => {
      this.showManifestModal = false;
      this.loadData();
    });
  }

  dispatch(id: number) {
    this.api.dispatchShipment(id, 'Dispatch Agent 01').subscribe(() => this.loadData());
  }

  closeShipment(id: number) {
    this.api.closeShipment(id).subscribe(() => this.loadData());
  }
}
