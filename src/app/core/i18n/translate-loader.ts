import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import it from '../../../assets/i18n/it.json';
import en from '../../../assets/i18n/en.json';

const BUNDLES: Record<string, TranslationObject> = {
  it: it as TranslationObject,
  en: en as TranslationObject,
};

/** Le traduzioni sono importate nel bundle in build, non scaricate via
 *  HTTP: evita ogni complicazione con HttpClient durante il pre-rendering
 *  (vedi supabase.service.ts per un problema analogo già risolto in questo
 *  progetto scegliendo import statici invece di chiamate di rete lato server). */
export class StaticTranslateLoader extends TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(BUNDLES[lang] ?? {});
  }
}
