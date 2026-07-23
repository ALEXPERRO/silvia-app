import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, afterNextRender, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { GalleryCategoryOption, GalleryItem } from '../../core/models/gallery-item.model';
import { Icon } from '../../shared/icon/icon';
import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [Icon, RevealOnScroll, TranslatePipe],
  templateUrl: './portfolio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Portfolio implements OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly document = inject(DOCUMENT);
  protected readonly allItems = signal<GalleryItem[]>([]);
  protected readonly itemsLoaded = signal(false);

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Esplora la raccolta di illustrazioni ad acquerello di Silvia Sgaramella: composizioni, animali, elementi botanici e insetti.',
    });

    afterNextRender(() => {
      this.supabase.getPublishedPortfolioItems().then((items) => {
        this.allItems.set(items);
        this.itemsLoaded.set(true);
      });
    });
  }

  protected readonly categories = computed<GalleryCategoryOption[]>(() => {
    const distinct = Array.from(new Set(this.allItems().map((item) => item.category)));
    return [{ value: 'tutte', label: 'Tutte' }, ...distinct.map((c) => ({ value: c, label: c }))];
  });
  protected readonly activeCategory = signal<string>('tutte');
  protected readonly lightboxItem = signal<GalleryItem | null>(null);
  protected readonly showLightboxSwipeHint = signal(false);
  protected readonly currentPage = signal(0);

  private touchStartX = 0;
  private touchStartY = 0;

  protected readonly filteredItems = computed(() => {
    const category = this.activeCategory();
    const items = this.allItems();
    return category === 'tutte' ? items : items.filter((item) => item.category === category);
  });

  protected readonly totalPages = computed(() => Math.ceil(this.filteredItems().length / PAGE_SIZE));

  protected readonly pagedItems = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredItems().slice(start, start + PAGE_SIZE);
  });

  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i));

  protected readonly lightboxIndex = computed(() => {
    const item = this.lightboxItem();
    if (!item) return -1;
    return this.filteredItems().findIndex((i) => i.src === item.src);
  });

  setCategory(category: string): void {
    this.activeCategory.set(category);
    this.currentPage.set(0);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.scrollToGrid();
  }

  prevPage(): void {
    this.currentPage.update((p) => Math.max(0, p - 1));
    this.scrollToGrid();
  }

  nextPage(): void {
    this.currentPage.update((p) => Math.min(this.totalPages() - 1, p + 1));
    this.scrollToGrid();
  }

  openLightbox(item: GalleryItem): void {
    this.lightboxItem.set(item);
    this.showLightboxSwipeHint.set(true);
    this.document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
    this.document.body.style.overflow = '';
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = '';
  }

  private scrollToGrid(): void {
    this.document.getElementById('galleria')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  showNext(): void {
    const items = this.filteredItems();
    const idx = this.lightboxIndex();
    if (idx === -1 || items.length === 0) return;
    this.showLightboxSwipeHint.set(false);
    this.lightboxItem.set(items[(idx + 1) % items.length]);
  }

  showPrev(): void {
    const items = this.filteredItems();
    const idx = this.lightboxIndex();
    if (idx === -1 || items.length === 0) return;
    this.showLightboxSwipeHint.set(false);
    this.lightboxItem.set(items[(idx - 1 + items.length) % items.length]);
  }

  onLightboxTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].clientX;
    this.touchStartY = event.changedTouches[0].clientY;
  }

  onLightboxTouchEnd(event: TouchEvent): void {
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    const dy = event.changedTouches[0].clientY - this.touchStartY;
    // solo gesti chiaramente orizzontali, per non confondere lo swipe con un tap
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) this.showNext();
    else this.showPrev();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.lightboxItem()) return;
    if (event.key === 'ArrowRight') this.showNext();
    if (event.key === 'ArrowLeft') this.showPrev();
    if (event.key === 'Escape') this.closeLightbox();
  }
}
