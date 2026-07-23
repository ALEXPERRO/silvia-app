import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  templateUrl: './language-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  protected readonly i18n = inject(LanguageService);
  /** Mostra solo la lingua corrente, cliccabile per passare all'altra: utile dove lo spazio è stretto (es. footer mobile). */
  @Input() compact = false;

  protected toggle(): void {
    this.i18n.setLanguage(this.i18n.currentLang() === 'it' ? 'en' : 'it');
  }
}
