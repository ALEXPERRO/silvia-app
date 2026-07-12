import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
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

  protected readonly cover = this.content.cover;
  protected readonly shopUrl = this.content.shopUrl;
  protected readonly nextEvent = this.content.events[0];
  protected readonly portfolioPreview = [
    'images/animali/volpe1.png',
    'images/animali/kingfisher.png',
    'images/elementi botanici/giglio2.png',
    'images/insetti/farfalle colorate/farfalla colorata1.png',
  ];
}
