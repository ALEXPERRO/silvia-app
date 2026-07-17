import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ContentService } from '../../core/services/content.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [Icon],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  private readonly content = inject(ContentService);

  protected readonly footer = this.content.footer;
}
