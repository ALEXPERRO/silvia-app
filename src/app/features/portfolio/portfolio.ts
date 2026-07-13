import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { ContentService } from '../../core/services/content.service';
import { GalleryCategory, GalleryItem } from '../../core/models/gallery-item.model';
import { Icon } from '../../shared/icon/icon';
import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgOptimizedImage, Icon, RevealOnScroll],
  templateUrl: './portfolio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Portfolio implements OnDestroy {
  private readonly content = inject(ContentService);
  private readonly document = inject(DOCUMENT);
  private readonly allItems = this.content.galleryItems;

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Esplora la raccolta di illustrazioni ad acquerello di Silvia Sgaramella: composizioni, animali, elementi botanici e insetti.',
    });
  }

  protected readonly categories = this.content.galleryCategories;
  protected readonly activeCategory = signal<GalleryCategory | 'tutte'>('tutte');
  protected readonly lightboxItem = signal<GalleryItem | null>(null);
  protected readonly currentPage = signal(0);

  protected readonly filteredItems = computed(() => {
    const category = this.activeCategory();
    return category === 'tutte' ? this.allItems : this.allItems.filter((item) => item.category === category);
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

  setCategory(category: GalleryCategory | 'tutte'): void {
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
    this.lightboxItem.set(items[(idx + 1) % items.length]);
  }

  showPrev(): void {
    const items = this.filteredItems();
    const idx = this.lightboxIndex();
    if (idx === -1 || items.length === 0) return;
    this.lightboxItem.set(items[(idx - 1 + items.length) % items.length]);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.lightboxItem()) return;
    if (event.key === 'ArrowRight') this.showNext();
    if (event.key === 'ArrowLeft') this.showPrev();
    if (event.key === 'Escape') this.closeLightbox();
  }
}
