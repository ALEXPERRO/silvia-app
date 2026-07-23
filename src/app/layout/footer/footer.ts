import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ContentService } from '../../core/services/content.service';
import { Icon } from '../../shared/icon/icon';
import { LanguageToggle } from '../../shared/language-toggle/language-toggle';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [Icon, TranslatePipe, LanguageToggle],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  private readonly content = inject(ContentService);

  protected readonly footer = this.content.footer;
}
