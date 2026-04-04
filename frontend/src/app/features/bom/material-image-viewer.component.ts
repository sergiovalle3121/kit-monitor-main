import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
} from '@angular/core';

export interface BomVisualItem {
  partNumber: string;
  description?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
  specUrl?: string | null;
}

@Component({
  selector: 'app-material-image-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './material-image-viewer.component.html',
  styleUrls: ['./material-image-viewer.component.css'],
})
export class MaterialImageViewerComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Input() model = '';
  @Input() items: BomVisualItem[] = [];
  @Input() activeIndex = 0;

  @Output() closed = new EventEmitter<void>();
  @Output() indexChanged = new EventEmitter<number>();

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.renderer.appendChild(this.document.body, this.host.nativeElement);
  }

  ngOnDestroy(): void {
    const parent = this.host.nativeElement.parentNode;
    if (parent) {
      this.renderer.removeChild(parent, this.host.nativeElement);
    }
  }

  get safeItems(): BomVisualItem[] {
    return this.items.filter(item => !!item.imageUrl);
  }

  get current(): BomVisualItem | null {
    if (!this.safeItems.length) return null;
    return this.safeItems[this.clampedIndex];
  }

  get clampedIndex(): number {
    if (!this.safeItems.length) return 0;
    if (this.activeIndex < 0) return 0;
    if (this.activeIndex >= this.safeItems.length) return this.safeItems.length - 1;
    return this.activeIndex;
  }

  close(): void {
    this.closed.emit();
  }

  previous(): void {
    if (!this.safeItems.length) return;
    const nextIndex = (this.clampedIndex - 1 + this.safeItems.length) % this.safeItems.length;
    this.indexChanged.emit(nextIndex);
  }

  next(): void {
    if (!this.safeItems.length) return;
    const nextIndex = (this.clampedIndex + 1) % this.safeItems.length;
    this.indexChanged.emit(nextIndex);
  }

  select(index: number): void {
    this.indexChanged.emit(index);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target.src.endsWith('.jpg')) {
      target.src = target.src.replace('.jpg', '.svg');
      return;
    }
    target.style.opacity = '0.18';
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }
}
