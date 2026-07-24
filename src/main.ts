import { bootstrapApplication } from '@angular/platform-browser';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Solo client-side: main.ts è il bootstrap del browser, separato da
// main.server.ts usato per l'SSR/prerendering.
inject();
injectSpeedInsights();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
