import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { filter, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

interface SearchResult {
  label: string;
  route: string;
  category: 'modulos' | 'kits_modelos' | 'np' | 'publicaciones';
  subtitle?: string;
}

interface ShellNotification {
  id: string;
  message: string;
  type: 'publication' | 'kit_ready' | 'partial' | 'ops' | 'cancellation';
  createdAt: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmModalComponent],
  templateUrl: './shell.html',
  styleUrls: ['./shell.css'],
})
export class ShellComponent implements OnInit, OnDestroy {
  collapsed = false;
  openSection: string | null = null;
  searchTerm = '';
  showSearchResults = false;
  searchResults: SearchResult[] = [];
  showUserPanel = false;
  showNotifications = false;
  notifications: ShellNotification[] = [];
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('searchWrapper') searchWrapper?: ElementRef<HTMLElement>;
  @ViewChild('notificationsWrap') notificationsWrap?: ElementRef<HTMLElement>;
  @ViewChild('userWrap') userWrap?: ElementRef<HTMLElement>;
  private notificationsTimerId: number | null = null;

  private readonly modulesCatalog: SearchResult[] = [
    { label: 'Monitor', route: '/monitor', category: 'modulos' },
    { label: 'Planeación', route: '/plan', category: 'modulos' },
    { label: 'Pronóstico', route: '/forecast', category: 'modulos' },
    { label: 'BOM', route: '/bom', category: 'modulos' },
    { label: 'Kits', route: '/kits', category: 'modulos' },
    { label: 'Conteos', route: '/conteos', category: 'modulos' },
    { label: 'Disposición', route: '/disposition', category: 'modulos' },
    { label: 'Ayudas visuales', route: '/visual-aids', category: 'modulos' },
    { label: 'Producción', route: '/production', category: 'modulos' },
    { label: 'Hora por hora', route: '/production/hourly', category: 'modulos' },
    { label: 'Corridas terminadas', route: '/production/completed', category: 'modulos' },
    { label: 'Logística en vivo', route: '/production/logistics', category: 'modulos' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private readonly api: ApiService,
  ) {
    this.syncSection(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncSection(event.urlAfterRedirects);
        this.showSearchResults = false;
        this.showUserPanel = false;
      });
  }

  ngOnInit(): void {
    this.refreshNotifications();
    this.notificationsTimerId = window.setInterval(() => this.refreshNotifications(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.notificationsTimerId !== null) {
      window.clearInterval(this.notificationsTimerId);
    }
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  toggleSection(section: string): void {
    this.openSection = this.openSection === section ? null : section;
  }

  logout(): void {
    this.auth.logout();
  }

  onSearchFocus(): void {
    this.showSearchResults = true;
    this.computeSearchResults();
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.computeSearchResults();
    this.showSearchResults = true;
  }

  openSearchResult(result: SearchResult): void {
    this.router.navigateByUrl(result.route);
    this.searchTerm = '';
    this.showSearchResults = false;
  }

  toggleUserPanel(): void {
    this.showUserPanel = !this.showUserPanel;
    this.showNotifications = false;
  }

  toggleNotifications(): void {
    if (!this.showNotifications) {
      this.refreshNotifications();
    }
    this.showNotifications = !this.showNotifications;
    this.showUserPanel = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;

    if (this.searchWrapper?.nativeElement && !this.searchWrapper.nativeElement.contains(target)) {
      this.showSearchResults = false;
    }
    if (this.notificationsWrap?.nativeElement && !this.notificationsWrap.nativeElement.contains(target)) {
      this.showNotifications = false;
    }
    if (this.userWrap?.nativeElement && !this.userWrap.nativeElement.contains(target)) {
      this.showUserPanel = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showSearchResults = false;
    this.showNotifications = false;
    this.showUserPanel = false;
  }

  clearNotifications(): void {
    this.notifications = [];
    localStorage.removeItem('km_shell_notifications');
  }

  private computeSearchResults(): void {
    const term = this.searchTerm.trim().toUpperCase();
    if (!term) {
      this.searchResults = this.modulesCatalog.slice(0, 6);
      return;
    }

    const localMatches = this.modulesCatalog.filter((entry) => entry.label.toUpperCase().includes(term));
    const dynamicMatches = this.buildDynamicSearch(term);
    this.searchResults = [...localMatches, ...dynamicMatches].slice(0, 12);
  }

  private buildDynamicSearch(term: string): SearchResult[] {
    const results: SearchResult[] = [];
    this.notifications
      .filter((item) => item.message.toUpperCase().includes(term))
      .slice(0, 3)
      .forEach((item) => {
        results.push({
          label: item.message,
          route: item.type === 'publication' ? '/plan' : '/production',
          category: 'publicaciones',
          subtitle: this.formatTimestamp(item.createdAt),
        });
      });
    return results;
  }

  private refreshNotifications(): void {
    forkJoin({
      publications: this.api.getPlanPublications(),
      kits: this.api.getKits(),
      backends: this.api.getProductionBackends(),
      cancellations: this.api.getRecentCancellationRequests(),
    }).subscribe({
      next: ({ publications, kits, backends, cancellations }) => {
        const now = Date.now();
        const fromPublications = (publications ?? []).slice(0, 8).map((item: any) => ({
          id: `pub-${item.id}`,
          message: `Plan publicado #${item.id} (${item.title ?? 'sin título'})`,
          type: 'publication' as const,
          createdAt: item.createdAt ?? new Date().toISOString(),
        }));

        const fromReadyKits = (kits ?? [])
          .filter((kit: any) => ['ready', 'requested'].includes(kit.status))
          .slice(0, 8)
          .map((kit: any) => ({
            id: `kit-ready-${kit.id}`,
            message: `Kit listo para línea: ${kit.plan?.model ?? 'N/A'} BK${kit.plan?.backen ?? '-'}`,
            type: 'kit_ready' as const,
            createdAt: kit.updatedAt ?? kit.createdAt ?? new Date().toISOString(),
          }));

        const fromPartial = (kits ?? [])
          .filter((kit: any) => (kit.totalCompleted ?? 0) > 0 && (kit.totalCompleted ?? 0) < (kit.plan?.quantity ?? Number.MAX_SAFE_INTEGER))
          .slice(0, 8)
          .map((kit: any) => ({
            id: `kit-partial-${kit.id}`,
            message: `Ensamble parcial ${kit.plan?.model ?? 'N/A'}: ${kit.totalCompleted}/${kit.plan?.quantity ?? 0}`,
            type: 'partial' as const,
            createdAt: kit.updatedAt ?? kit.createdAt ?? new Date().toISOString(),
          }));

        const fromOps = (backends ?? [])
          .filter((backend: any) => backend.status === 'in_progress')
          .slice(0, 6)
          .map((backend: any) => ({
            id: `ops-${backend.kitId}`,
            message: `Operación activa ${backend.backendCode ?? `BK${backend.backen}`}: ${backend.model ?? 'N/A'}`,
            type: 'ops' as const,
            createdAt: backend.startedAt ?? new Date().toISOString(),
          }));

        const fromCancellations = (cancellations ?? [])
          .slice(0, 20)
          .map((request: any) => {
            const wo = request?.publication?.workOrder ?? 'WO';
            const model = request?.publication?.model ?? 'N/A';
            if (request.status === 'pending') {
              return {
                id: `cancel-${request.id}`,
                message: `⚠️ Planeación solicita cancelar el kit ${wo} de ${model}. Tienes 30 minutos para responder.`,
                type: 'cancellation' as const,
                createdAt: request.createdAt ?? new Date().toISOString(),
              };
            }
            if (request.status === 'accepted') {
              return {
                id: `cancel-${request.id}`,
                message: `El kitteador autorizó la cancelación de ${wo}. Ya puedes eliminar la publicación.`,
                type: 'cancellation' as const,
                createdAt: request.respondedAt ?? request.createdAt ?? new Date().toISOString(),
              };
            }
            if (request.status === 'rejected') {
              return {
                id: `cancel-${request.id}`,
                message: `El kitteador rechazó la cancelación del kit ${wo}. La publicación se conserva.`,
                type: 'cancellation' as const,
                createdAt: request.respondedAt ?? request.createdAt ?? new Date().toISOString(),
              };
            }
            return {
              id: `cancel-${request.id}`,
              message: `Sin respuesta del kitteador. Cancelación de ${wo} rechazada por timeout.`,
              type: 'cancellation' as const,
              createdAt: request.respondedAt ?? request.expiresAt ?? request.createdAt ?? new Date().toISOString(),
            };
          });

        const merged = [...fromPublications, ...fromReadyKits, ...fromPartial, ...fromOps, ...fromCancellations]
          .filter((item) => now - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        this.notifications = merged;
        localStorage.setItem('km_shell_notifications', JSON.stringify(merged));
      },
      error: () => {
        const cached = localStorage.getItem('km_shell_notifications');
        this.notifications = cached ? JSON.parse(cached) : [];
      },
    });
  }

  notificationTypeLabel(type: ShellNotification['type']): string {
    if (type === 'publication') return 'Publicación';
    if (type === 'kit_ready') return 'Kit listo';
    if (type === 'partial') return 'Parcial';
    if (type === 'cancellation') return 'Cancelación';
    return 'Operación';
  }

  formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'sin fecha';
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  private syncSection(url: string): void {
    if (url.startsWith('/plan') || url.startsWith('/forecast')) {
      this.openSection = 'plan';
      return;
    }

    if (url.startsWith('/bom') || url.startsWith('/kits') || url.startsWith('/conteos')) {
      this.openSection = 'ic';
      return;
    }

    if (url.startsWith('/production')) {
      this.openSection = 'prod';
      return;
    }

    if (url.startsWith('/visual-aids') || url.startsWith('/disposition')) {
      this.openSection = 'ie';
      return;
    }

    this.openSection = null;
  }
}
