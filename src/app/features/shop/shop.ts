import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Meta } from '@angular/platform-browser';
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

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Stampe, sticker e segnalibri illustrati ad acquerello: visita lo shop Etsy di Blooming Wild ART.',
    });
  }

  protected readonly shopUrl = this.content.shopUrl;
  protected readonly products = this.content.shopProducts;
}
