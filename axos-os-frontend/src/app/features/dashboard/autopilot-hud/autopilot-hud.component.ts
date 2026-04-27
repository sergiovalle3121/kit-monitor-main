import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
} from '@angular/animations';
import {
  SignalsService,
  CorrectiveProposal,
  CriticalEvent,
  ConnectionStatus,
} from '../../../core/signals.service';
import { AuthService } from '../../../core/auth.service';

const PROPOSAL_DISPLAY_LIMIT = 6;

@Component({
  selector: 'app-autopilot-hud',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './autopilot-hud.component.html',
  styleUrls: ['./autopilot-hud.component.css'],
  animations: [
    // Staggered entry for the proposal list items
    trigger('listStagger', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateX(24px)' }),
          stagger('60ms', [
            animate(
              '320ms cubic-bezier(0.22, 1, 0.36, 1)',
              style({ opacity: 1, transform: 'translateX(0)' }),
            ),
          ]),
        ], { optional: true }),
      ]),
    ]),
    // Single-item entry for newly pushed proposals
    trigger('itemEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(32px) scale(0.95)' }),
        animate(
          '380ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateX(0) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateX(32px) scale(0.95)' }),
        ),
      ]),
    ]),
    // HUD panel slide-in
    trigger('hudSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-16px)' }),
        animate('400ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class AutopilotHudComponent implements OnInit, OnDestroy {
  proposals: CorrectiveProposal[] = [];
  criticalEvents: CriticalEvent[] = [];
  status: ConnectionStatus = 'disconnected';
  executingId: number | null = null;
  hudMinimized = false;

  private readonly subs = new Subscription();

  constructor(
    private readonly signals: SignalsService,
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Load existing pending proposals
    this.loadProposals();

    // Connect WebSocket
    this.signals.connect('default');

    this.subs.add(
      this.signals.status$.subscribe((s) => {
        this.status = s;
        this.cdr.markForCheck();
      }),
    );

    this.subs.add(
      this.signals.proposals$.subscribe((p) => {
        this.proposals = [p, ...this.proposals].slice(0, PROPOSAL_DISPLAY_LIMIT);
        this.cdr.markForCheck();
      }),
    );

    this.subs.add(
      this.signals.criticalEvents$.subscribe((e) => {
        this.criticalEvents = [e, ...this.criticalEvents].slice(0, 3);
        this.cdr.markForCheck();
        // Auto-dismiss critical event toast after 8s
        setTimeout(() => {
          this.criticalEvents = this.criticalEvents.filter((ev) => ev !== e);
          this.cdr.markForCheck();
        }, 8000);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  executeFix(proposal: CorrectiveProposal): void {
    if (this.executingId === proposal.id) return;
    this.executingId = proposal.id;

    this.http
      .post<any>(`/api/autopilot/proposals/${proposal.id}/execute`, {})
      .subscribe({
        next: () => {
          this.proposals = this.proposals.map((p) =>
            p.id === proposal.id ? { ...p, status: 'executed' } : p,
          );
          this.executingId = null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.executingId = null;
          this.cdr.markForCheck();
        },
      });
  }

  dismiss(proposal: CorrectiveProposal): void {
    this.proposals = this.proposals.filter((p) => p.id !== proposal.id);
  }

  dismissEvent(event: CriticalEvent): void {
    this.criticalEvents = this.criticalEvents.filter((e) => e !== event);
  }

  toggleMinimize(): void {
    this.hudMinimized = !this.hudMinimized;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get pendingCount(): number {
    return this.proposals.filter((p) => p.status === 'pending').length;
  }

  severityIcon(s: CorrectiveProposal['severity']): string {
    return s === 'critical' ? 'fa-triangle-exclamation'
         : s === 'high'     ? 'fa-circle-exclamation'
         : s === 'medium'   ? 'fa-circle-dot'
                            : 'fa-circle-info';
  }

  categoryIcon(c: CorrectiveProposal['category']): string {
    return c === 'bottleneck'        ? 'fa-gauge-high'
         : c === 'sigma_instability' ? 'fa-wave-square'
         : c === 'shortage'          ? 'fa-box-open'
                                    : 'fa-screwdriver-wrench';
  }

  statusDotClass(): string {
    return this.status === 'connected'    ? 'dot-green'
         : this.status === 'connecting'   ? 'dot-amber'
         : this.status === 'error'        ? 'dot-red'
                                          : 'dot-grey';
  }

  trackById(_: number, p: CorrectiveProposal): number { return p.id; }

  private loadProposals(): void {
    this.http
      .get<CorrectiveProposal[]>('/api/autopilot/proposals?status=pending')
      .subscribe({
        next: (list) => {
          this.proposals = list.slice(0, PROPOSAL_DISPLAY_LIMIT);
          this.cdr.markForCheck();
        },
        error: () => { /* Silently ignore — HUD is non-critical */ },
      });
  }
}
