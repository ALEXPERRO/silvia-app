import { Injectable } from '@angular/core';
import { ShopProduct } from '../models/product.model';

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

  /**
   * Prodotti Etsy segnaposto: sostituire src/etsyUrl/prezzo con i dati reali del negozio
   * appena disponibili. Le immagini riusano illustrazioni già presenti in public/images.
   */
  readonly shopUrl = 'https://www.etsy.com/shop/BloomingWildArt';

  readonly shopProducts: ShopProduct[] = [
    {
      id: 1,
      title: 'Stampa Lovebirds',
      description: 'Stampa fine-art in edizione limitata, illustrazione originale ad acquerello.',
      price: '€ 18,00',
      image: 'images/animali/bird1.webp',
      etsyUrl: 'https://www.etsy.com/shop/BloomingWildArt',
    },
    {
      id: 2,
      title: 'Set Cartoline Botaniche',
      description: 'Set di 6 cartoline con illustrazioni botaniche originali, carta 350gr.',
      price: '€ 12,00',
      image: 'images/elementi botanici/fiore.webp',
      etsyUrl: 'https://www.etsy.com/shop/BloomingWildArt',
    },
    {
      id: 3,
      title: 'Stampa Barbagianni e Luna',
      description: "Illustrazione notturna in edizione numerata, formato A4.",
      price: '€ 22,00',
      image: 'images/animali/barbagianni.webp',
      etsyUrl: 'https://www.etsy.com/shop/BloomingWildArt',
    },
    {
      id: 4,
      title: 'Adesivi Elementi Botanici',
      description: 'Foglio di adesivi vinilici resistenti all\'acqua con i soggetti botanici più amati.',
      price: '€ 6,50',
      image: 'images/elementi botanici/giglio1.webp',
      etsyUrl: 'https://www.etsy.com/shop/BloomingWildArt',
    },
  ];
}
