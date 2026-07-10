import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [NgOptimizedImage, RevealOnScroll],
  templateUrl: './shop.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shop {
  private readonly content = inject(ContentService);

  protected readonly shopUrl = this.content.shopUrl;
  protected readonly products = this.content.shopProducts;
}
