import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';
import { FilterProductsPipe } from '../../shared/pipes/filter-products.pipe';

export interface ProductSku {
  sku: string;
  model: string;
  description: string;
}

interface CostBreakdown {
  materialsCost: number;
  laborCost: number;
  overheadCost: number;
  totalUnitCost: number;
  materialsPercent: number;
  laborPercent: number;
  overheadPercent: number;
}

@Component({
  selector: 'app-finance-cost-rollup',
  standalone: true,
  imports: [EnterpriseContextBannerComponent, CommonModule, FormsModule, FilterProductsPipe],
  templateUrl: './finance-cost-rollup.component.html',
  styleUrls: ['./finance-cost-rollup.component.css'],
})
export class FinanceCostRollupComponent implements OnInit {
  loading = false;
  error: string | null = null;
  searchQuery = '';
  selectedProduct: ProductSku | null = null;
  costData: CostBreakdown | null = null;
  availableProducts: ProductSku[] = [];
  showDropdown = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadAvailableProducts();
  }

  loadAvailableProducts(): void {
    this.loading = true;
    // Placeholder for future API endpoint to fetch products/SKUs
    // For now, using mock data that will be replaced by Transaction entity data
    setTimeout(() => {
      this.availableProducts = [
        { sku: 'AX-1000-A', model: 'AX-1000', description: 'Industrial Controller Unit' },
        { sku: 'AX-2000-B', model: 'AX-2000', description: 'Power Distribution Module' },
        { sku: 'AX-3000-C', model: 'AX-3000', description: 'Sensor Array Assembly' },
        { sku: 'NX-5000-X', model: 'NX-5000', description: 'Next-Gen Processing Hub' },
        { sku: 'PX-7000-Z', model: 'PX-7000', description: 'Precision Actuator System' },
      ];
      this.loading = false;
    }, 800);
  }

  onSearchFocus(): void {
    this.showDropdown = true;
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
  }

  selectProduct(product: ProductSku): void {
    this.selectedProduct = product;
    this.searchQuery = `${product.sku} — ${product.description}`;
    this.showDropdown = false;
    this.loadCostData(product.sku);
  }

  loadCostData(sku: string): void {
    this.loading = true;
    this.error = null;
    
    // Simulated API call - will be connected to Transaction entity backend
    // Future endpoint: this.api.getCostRollup(sku)
    setTimeout(() => {
      // Mock data demonstrating the cost roll-up structure
      const materialsCost = 145.50;
      const laborCost = 78.25;
      const overheadCost = 42.80;
      const totalUnitCost = materialsCost + laborCost + overheadCost;

      this.costData = {
        materialsCost,
        laborCost,
        overheadCost,
        totalUnitCost,
        materialsPercent: Math.round((materialsCost / totalUnitCost) * 100),
        laborPercent: Math.round((laborCost / totalUnitCost) * 100),
        overheadPercent: Math.round((overheadCost / totalUnitCost) * 100),
      };
      this.loading = false;
    }, 1200);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }

  clearSelection(): void {
    this.selectedProduct = null;
    this.costData = null;
    this.searchQuery = '';
  }
}
