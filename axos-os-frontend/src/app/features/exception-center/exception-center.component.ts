import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';

@Component({
  selector: 'app-exception-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, EnterpriseContextBannerComponent],
  templateUrl: './exception-center.component.html',
  styleUrls: ['./exception-center.component.css']
})
export class ExceptionCenterComponent implements OnInit {
  private api = inject(ApiService);

  exceptions: any[] = [];
  filteredExceptions: any[] = [];
  loading = true;
  error: string | null = null;

  // Filters
  filterDomain = 'all';
  filterSeverity = 'all';
  filterStatus = 'OPEN';

  // Stats
  stats = {
    critical: 0,
    high: 0,
    open: 0
  };

  selectedException: any | null = null;

  domains = ['PLANNING', 'QUALITY', 'INVENTORY', 'WAREHOUSE', 'PRODUCTION', 'SHIPPING', 'GOVERNANCE'];
  severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  statuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

  ngOnInit() {
    this.loadExceptions();
  }

  loadExceptions() {
    this.loading = true;
    this.api.getOperationalExceptions({ status: this.filterStatus === 'all' ? undefined : this.filterStatus })
      .subscribe({
        next: (data) => {
          this.exceptions = data;
          this.applyFilters();
          this.calculateStats();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Error al cargar excepciones industriales';
          this.loading = false;
          console.error(err);
        }
      });
  }

  applyFilters() {
    this.filteredExceptions = this.exceptions.filter(ex => {
      const matchDomain = this.filterDomain === 'all' || ex.domain === this.filterDomain;
      const matchSeverity = this.filterSeverity === 'all' || ex.severity === this.filterSeverity;
      const matchStatus = this.filterStatus === 'all' || ex.status === this.filterStatus;
      return matchDomain && matchSeverity && matchStatus;
    });
  }

  calculateStats() {
    this.stats.critical = this.exceptions.filter(ex => ex.severity === 'CRITICAL' && ex.status !== 'RESOLVED').length;
    this.stats.high = this.exceptions.filter(ex => ex.severity === 'HIGH' && ex.status !== 'RESOLVED').length;
    this.stats.open = this.exceptions.filter(ex => ex.status === 'OPEN').length;
  }

  selectException(ex: any) {
    this.selectedException = ex;
  }

  updateStatus(ex: any, newStatus: string) {
    this.api.updateOperationalExceptionStatus(ex.id, newStatus)
      .subscribe({
        next: () => {
          ex.status = newStatus;
          if (this.selectedException && this.selectedException.id === ex.id) {
            this.selectedException.status = newStatus;
          }
          this.loadExceptions(); // Refresh to update filters/stats
        }
      });
  }

  severityClass(sev: string): string {
    return `sev-${sev.toLowerCase()}`;
  }

  getDomainIcon(domain: string): string {
    const icons: any = {
      PLANNING: 'fa-calendar-alt',
      QUALITY: 'fa-check-double',
      INVENTORY: 'fa-boxes',
      WAREHOUSE: 'fa-warehouse',
      PRODUCTION: 'fa-industry',
      SHIPPING: 'fa-truck',
      GOVERNANCE: 'fa-shield-halved'
    };
    return icons[domain] || 'fa-exclamation-circle';
  }

  getResourceLink(ex: any): string {
    if (ex.resourceType === 'Kit') return `/production`;
    if (ex.resourceType === 'InventoryPosition') return `/materials/inventory`;
    if (ex.resourceType === 'Ncr' || ex.resourceType === 'NCR') return `/ncr-center`;
    if (ex.resourceType === 'QualityHold') return `/quality-center`;
    if (ex.resourceType === 'QuarantineTransfer') return `/quality-center`;
    if (ex.resourceType === 'Disposition') return `/disposition`;
    if (ex.resourceType === 'CAPA') return `/capa-center`;
    if (ex.resourceType === 'IQC_INSPECTION') return `/iqc-center`;
    return '#';
  }

  getAging(createdAt: string): string {
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diff = now - start;
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
}
