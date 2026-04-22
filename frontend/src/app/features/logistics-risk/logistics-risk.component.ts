import { Component } from '@angular/core';
import { MaterialsResupplyControlComponent } from '../materials-resupply-control/materials-resupply-control.component';

@Component({
  selector: 'app-logistics-risk',
  standalone: true,
  imports: [MaterialsResupplyControlComponent],
  template: '<app-materials-resupply-control />',
})
export class LogisticsRiskComponent {}
