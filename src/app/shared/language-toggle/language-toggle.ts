import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  templateUrl: './language-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  protected readonly i18n = inject(LanguageService);
}
