import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgOptimizedImage, Icon],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);

  protected readonly cover = this.content.cover;
}
