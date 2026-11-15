import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_URL } from '../utils/event-format.util';

export interface SeoPageData {
  /** Titolo della pagina (senza suffisso: viene aggiunto dove serve dal chiamante). */
  title: string;
  description: string;
  /** Path assoluto dal dominio, es. "/eventi" oppure "/" per la home. */
  path: string;
  /** URL assoluta dell'immagine social; default og-card.webp. */
  image?: string;
  /** Es. "noindex, follow" per pagine che non devono finire nei risultati di ricerca. */
  robots?: string;
}

const DEFAULT_IMAGE = `${SITE_URL}/images/og-card.webp`;
const JSON_LD_ID = 'seo-json-ld';

/** Centralizza title, description, Open Graph/Twitter card, canonical e
 *  JSON-LD per-pagina così ogni feature non duplica la stessa sequenza di
 *  Meta.updateTag. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);
  private readonly doc = inject(DOCUMENT);

  set(data: SeoPageData): void {
    const url = `${SITE_URL}${data.path}`;
    const image = data.image ?? DEFAULT_IMAGE;

    this.titleService.setTitle(data.title);
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:title', content: data.title });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    if (data.robots) {
      this.meta.updateTag({ name: 'robots', content: data.robots });
    } else {
      this.meta.removeTag('name="robots"');
    }

    this.setCanonical(url);
  }

  /** Inietta/aggiorna un blocco JSON-LD dedicato alla pagina corrente (es.
   *  schema Event). Passare null rimuove il blocco (pagina senza evento). */
  setJsonLd(data: object | object[] | null): void {
    const existing = this.doc.getElementById(JSON_LD_ID);
    if (!data) {
      existing?.remove();
      return;
    }

    const script = existing ?? this.doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.id = JSON_LD_ID;
    script.textContent = JSON.stringify(data);
    if (!existing) {
      this.doc.head.appendChild(script);
    }
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
