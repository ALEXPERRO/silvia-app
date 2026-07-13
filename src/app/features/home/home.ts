import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { ContentService } from '../../core/services/content.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, Icon],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Blooming Wild ART — le illustrazioni ad acquerello di Silvia Sgaramella: flora, fauna e piccole magie botaniche. Scopri portfolio, workshop e shop.',
    });
  }

  protected readonly cover = this.content.cover;
  protected readonly shopUrl = this.content.shopUrl;
  protected readonly nextEvent = this.content.events[0];
  protected readonly portfolioPreview = [
    'images/animali/volpe1.webp',
    'images/animali/kingfisher.webp',
    'images/elementi botanici/giglio2.webp',
    'images/insetti/farfalle colorate/farfalla colorata1.webp',
  ];
}
