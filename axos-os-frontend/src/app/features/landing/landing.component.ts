import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private observer: IntersectionObserver | null = null;

  readonly flowSteps = [
    { label: 'Supplier',          icon: 'fa-truck-ramp-box',   code: 'SUP' },
    { label: 'Receiving',         icon: 'fa-dolly',            code: 'RCV' },
    { label: 'Warehouse',         icon: 'fa-warehouse',        code: 'WHS' },
    { label: 'Inventory Control', icon: 'fa-barcode',          code: 'INV' },
    { label: 'Kitting',           icon: 'fa-boxes-stacked',    code: 'KIT' },
    { label: 'Resupply',          icon: 'fa-truck-loading',    code: 'RSP' },
    { label: 'Production',        icon: 'fa-industry',         code: 'PRD' },
    { label: 'Quality',           icon: 'fa-certificate',      code: 'QUA' },
    { label: 'Shipping',          icon: 'fa-ship',             code: 'SHP' },
  ];

  readonly pillars = [
    { icon: 'fa-box-open',          label: 'Materials & IC',       desc: 'Receiving, warehouse, inventory, kitting, resupply' },
    { icon: 'fa-calendar-alt',      label: 'Planning',             desc: 'Production plans, forecasting, WO readiness' },
    { icon: 'fa-chalkboard-user',   label: 'Engineering',          desc: 'BOM, visual aids, bay layout, routing, SOPs' },
    { icon: 'fa-industry',          label: 'Production / MES',     desc: 'Shopfloor execution, hourly tracking, live monitor' },
    { icon: 'fa-certificate',       label: 'Quality',              desc: 'IQC, IPQC, OQC, NCR, CAPA, holds' },
    { icon: 'fa-truck-fast',        label: 'Logistics & Shipping', desc: 'Dispatch, packing, delivery, traceability' },
  ];

  readonly capabilities = [
    { stat: '100%',  label: 'Real-Time Execution',          desc: 'Live shopfloor data, zero lag between floor and dashboard.' },
    { stat: 'E2E',   label: 'Traceability Backbone',         desc: 'Immutable event ledger from receiving to shipping.' },
    { stat: 'Multi', label: 'Multi-Department Coordination', desc: 'One system governing every domain simultaneously.' },
    { stat: '360°',  label: 'Plant-Wide Visibility',         desc: 'From one part number to the full plant — all connected.' },
    { stat: 'AI',    label: 'Operational Intelligence',      desc: 'Decision support, forecasting, and shortage detection.' },
  ];

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initScrollReveal();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  launch(): void {
    this.router.navigateByUrl('/login');
  }

  private initScrollReveal(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => this.observer?.observe(el));
  }
}
