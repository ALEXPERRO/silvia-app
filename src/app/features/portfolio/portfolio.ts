import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { GalleryCategory, GalleryItem } from '../../core/models/gallery-item.model';
import { Icon } from '../../shared/icon/icon';
import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgOptimizedImage, Icon, RevealOnScroll],
  templateUrl: './portfolio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Portfolio {
  private readonly content = inject(ContentService);
  private readonly allItems = this.content.galleryItems;

  protected readonly categories = this.content.galleryCategories;
  protected readonly activeCategory = signal<GalleryCategory | 'tutte'>('tutte');
  protected readonly lightboxItem = signal<GalleryItem | null>(null);

  protected readonly filteredItems = computed(() => {
    const category = this.activeCategory();
    return category === 'tutte' ? this.allItems : this.allItems.filter((item) => item.category === category);
  });

  protected readonly lightboxIndex = computed(() => {
    const item = this.lightboxItem();
    if (!item) return -1;
    return this.filteredItems().findIndex((i) => i.src === item.src);
  });

  setCategory(category: GalleryCategory | 'tutte'): void {
    this.activeCategory.set(category);
  }

  openLightbox(item: GalleryItem): void {
    this.lightboxItem.set(item);
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
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
