import {
  Component, OnInit, OnDestroy, AfterViewInit,
  HostListener, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  opacity: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('netCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private observer: IntersectionObserver | null = null;
  private animationId: number | null = null;
  private nodes: Node[] = [];
  private ctx: CanvasRenderingContext2D | null = null;

  isScrolled = false;

  // Login modal state
  loginOpen = false;
  loginEmail = '';
  loginPassword = '';
  loginError: string | null = null;
  loginLoading = false;
  showPassword = false;

  readonly pillars = [
    { icon: 'fa-box-open',        label: 'Materials & IC',       desc: 'Receiving, warehouse, inventory, kitting, resupply' },
    { icon: 'fa-calendar-alt',    label: 'Planning',             desc: 'Production plans, forecasting, WO readiness' },
    { icon: 'fa-chalkboard-user', label: 'Engineering',          desc: 'BOM, visual aids, bay layout, routing, SOPs' },
    { icon: 'fa-industry',        label: 'Production / MES',     desc: 'Shopfloor execution, hourly tracking, live monitor' },
    { icon: 'fa-certificate',     label: 'Quality',              desc: 'IQC, IPQC, OQC, NCR, CAPA, holds' },
    { icon: 'fa-truck-fast',      label: 'Logistics & Shipping', desc: 'Dispatch, packing, delivery, traceability' },
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
    this.initNetworkCanvas();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  openLogin(): void {
    this.loginOpen = true;
    this.loginError = null;
    this.loginEmail = '';
    this.loginPassword = '';
    document.body.style.overflow = 'hidden';
  }

  closeLogin(): void {
    this.loginOpen = false;
    document.body.style.overflow = '';
  }

  submitLogin(): void {
    this.loginError = null;
    this.loginLoading = true;
    this.auth.login(this.loginEmail.trim(), this.loginPassword.trim()).subscribe({
      next: () => {
        this.loginLoading = false;
        this.closeLogin();
        this.router.navigateByUrl('/monitor');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.loginError = 'Credenciales incorrectas';
        } else if (err.status === 0) {
          this.loginError = 'No se pudo conectar al backend.';
        } else {
          this.loginError = err?.error?.message || 'No se pudo iniciar sesión';
        }
        this.loginLoading = false;
      },
    });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.loginOpen) this.closeLogin();
  }

  // ── Network Canvas (replaces video) ──────────────────────────
  private initNetworkCanvas(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    this.resizeCanvas(canvas);

    window.addEventListener('resize', () => this.resizeCanvas(canvas));

    this.spawnNodes(canvas);
    this.animate(canvas);
  }

  private resizeCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private spawnNodes(canvas: HTMLCanvasElement): void {
    const count = Math.floor((canvas.width * canvas.height) / 14000);
    this.nodes = Array.from({ length: Math.min(count, 90) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }

  private animate(canvas: HTMLCanvasElement): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move nodes
      for (const node of this.nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width)  node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      }

      // Draw connections
      const maxDist = 160;
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const dx = this.nodes[i].x - this.nodes[j].x;
          const dy = this.nodes[i].y - this.nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.3;
            ctx.beginPath();
            ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
            ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
            ctx.strokeStyle = `rgba(0, 180, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of this.nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${node.opacity})`;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 180, 255, ${node.opacity * 0.15})`;
        ctx.fill();
      }

      this.animationId = requestAnimationFrame(draw);
    };

    draw();
  }

  // ── Scroll Reveal ─────────────────────────────────────────────
  private initScrollReveal(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    );

    setTimeout(() => {
      document.querySelectorAll('.reveal').forEach((el) => this.observer?.observe(el));
    }, 100);
  }

  // ── Card Mouse Glow ───────────────────────────────────────────
  private initCardEffects(): void {
    setTimeout(() => {
      document.querySelectorAll('.glass-card').forEach(card => {
        card.addEventListener('mousemove', (e: any) => {
          const rect = card.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          (card as HTMLElement).style.setProperty('--mouse-x', `${x}%`);
          (card as HTMLElement).style.setProperty('--mouse-y', `${y}%`);
        });
      });
    }, 200);
  }
}
