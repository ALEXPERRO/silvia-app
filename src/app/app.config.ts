import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { StaticTranslateLoader } from './core/i18n/translate-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // scarica i chunk delle altre sezioni in background dopo il primo render,
      // così la navigazione (click o swipe) su mobile è istantanea
      withPreloading(PreloadAllModules),
    ),
    provideClientHydration(withEventReplay()),
    provideTranslateService({
      loader: provideTranslateLoader(StaticTranslateLoader),
      fallbackLang: 'it',
      lang: 'it',
    }),
  ],
};
