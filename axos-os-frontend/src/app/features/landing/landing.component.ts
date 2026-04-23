import { Component, OnInit, OnDestroy, AfterViewInit, HostListener } from '@angular/core';
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
    this.initCardEffects();
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
            // We keep observing for potential re-animations if desired, 
            // but for a landing page, once is usually enough.
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => this.observer?.observe(el));
  }

  private initCardEffects(): void {
    // We handle this via HostListener for performance or direct DOM for simplicity
    const cards = document.querySelectorAll('.glass-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e: any) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        (card as HTMLElement).style.setProperty('--mouse-x', `${x}%`);
        (card as HTMLElement).style.setProperty('--mouse-y', `${y}%`);
      });
    });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const nav = document.querySelector('.top-nav');
    if (window.scrollY > 50) {
      nav?.classList.add('nav-scrolled');
    } else {
      nav?.classList.remove('nav-scrolled');
    }
  }
}
