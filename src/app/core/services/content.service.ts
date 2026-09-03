import { Injectable } from '@angular/core';

export interface CoverImage {
  src: string;
  scale: number;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly cover = {
    main: { src: 'images/about_me/silvia.webp', scale: 1 } satisfies CoverImage,
    logo: { src: 'images/logo/title-plum.webp', scale: 1 } satisfies CoverImage,
  };

  readonly footer = {
    text: 'Blooming Wild ART',
    credits: '© 2026 Silvia Sgaramella. All rights reserved.',
  };

  readonly shopUrl = 'https://www.etsy.com/it/shop/BloomingWildArtShop';
}
