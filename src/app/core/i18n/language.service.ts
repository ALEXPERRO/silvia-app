import { Injectable, afterNextRender, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'it' | 'en';
const STORAGE_KEY = 'bw-lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly currentLang = signal<AppLang>('it');

  constructor() {
    // Il default lang e la lingua iniziale sono già impostati in app.config.ts
    // tramite provideTranslateService({ fallbackLang: 'it', lang: 'it' }).
    // Questa versione di TranslateService non espone setDefaultLang().
    this.translate.use('it');

    afterNextRender(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'it' || stored === 'en') {
        this.setLanguage(stored);
      }
    });
  }

  setLanguage(lang: AppLang): void {
    this.currentLang.set(lang);
    this.translate.use(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }
}
