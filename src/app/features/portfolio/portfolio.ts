import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

  setCategory(category: GalleryCategory | 'tutte'): void {
    this.activeCategory.set(category);
  }

  openLightbox(item: GalleryItem): void {
    this.lightboxItem.set(item);
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
  }
}
