import { Injectable } from '@angular/core';
import { PaintEvent } from '../models/event.model';
import { ShopProduct } from '../models/product.model';
import { GalleryCategory, GalleryCategoryOption, GalleryItem } from '../models/gallery-item.model';
import { PORTFOLIO_RAW_FILES } from '../data/portfolio-manifest.data';
import { titleFromFileName } from '../utils/text.util';

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

  readonly events: PaintEvent[] = [
    {
      id: 1,
      title: 'Paint & Pass! - Taranto',
      message: {
        body: "Per questa festa ti chiedo di abbandonare ogni forma di serietà e celebrare quel senso di meraviglia e drammaticità che si prova durante l'infanzia. Non c'è cosa più bella di entrare nell'età adulta portandosi dietro un po' di magia! Non vedo l'ora di divertirci insieme.",
      },
      date: 'Domenica 28 Giugno',
      time: 'Dalle 10:00 alle 13:00',
      location: 'Villa Peripato',
      address: 'Taranto',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d902.3278061068684!2d17.242222595367142!3d40.47400685701551!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x134703dddd2916a5%3A0x15173fd259978ab3!2sArena%20Villa%20Peripato!5e0!3m2!1sit!2sit!4v1781182084534!5m2!1sit!2sit',
      mapLink: 'https://maps.app.goo.gl/5kkY74PXWWHTWBuW7',
    },
    {
      id: 2,
      title: 'Paint & Pass! - Bari',
      message: {
        body: 'Bari si tinge dei colori della fantasia! Unisciti a noi per una mattinata di pittura libera e condivisa a due passi dal mare. Porta la tua voglia di sperimentare e lascia che il pennello parli per te. Nessuna regola, solo pura espressione cromatica.',
      },
      date: 'Lunedì 29 Giugno',
      time: 'Dalle 18:00 alle 21:00',
      location: 'Piazza del Ferrarese',
      address: 'Bari (BA)',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3000.9413204918733!2d16.87184287661214!3d41.127814411475734!2m3!1f0!2f0!3f0!3m2!1s0x1347e85292eb5f9d%3A0x7d6f5f9a76d8b0eb!2sPiazza%20del%20Ferrarese%2C%2070122%20Bari%20BA!5e0!3m2!1sit!2sit!4v1710000000000',
      mapLink: 'https://maps.google.com/?q=Piazza+del+Ferrarese+Bari',
    },
    {
      id: 3,
      title: 'Paint & Pass! - Lecce',
      message: {
        body: 'Sotto il cielo barocco di Lecce, accendiamo la miccia della creatività. Questa sessione speciale unisce le sfumature della pittura all\'energia del Salento. Un\'esperienza immersiva studiata per riconnetterci con la gioia dell\'arte condivisa.',
      },
      date: 'Sabato 04 Luglio',
      time: 'Dalle 20:30 alle 23:30',
      location: 'Piazza del Duomo',
      address: 'Lecce (LE)',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3035.1232049187333!2d18.16812347661214!3d40.352114411475734!2m3!1f0!2f0!3f0!3m2!1s0x1344295292eb5f9d%3A0x7d6f5f9a76d8b0eb!2sPiazza%20del%20Duomo%2C%20Lecce!5e0!3m2!1sit!2sit!4v1710000000002',
      mapLink: 'https://maps.google.com/?q=Piazza+del+Duomo+Lecce',
    },
    {
      id: 4,
      title: 'Paint & Pass! - Foggia',
      message: {
        body: 'Chiudiamo il cerchio con un appuntamento esplosivo a Foggia. Un pomeriggio all\'insegna del divertimento visivo, dei colori accesi e delle risate. Lasciati travolgere dal format che rompe le barriere tra pubblico e cavalletto!',
      },
      date: 'Domenica 12 Luglio',
      time: 'Dalle 16:00 alle 19:00',
      location: 'Corso Vittorio Emanuele',
      address: 'Foggia (FG)',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3011.1232049187333!2d15.55312347661214!3d41.462114411475734!2m3!1f0!2f0!3f0!3m2!1s0x133c295292eb5f9d%3A0x7d6f5f9a76d8b0eb!2sCorso%20Vittorio%20Emanuele%2C%20Foggia!5e0!3m2!1sit!2sit!4v1710000000003',
      mapLink: 'https://maps.google.com/?q=Corso+Vittorio+Emanuele+Foggia',
    },
  ];

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

  readonly galleryCategories: GalleryCategoryOption[] = [
    { value: 'tutte', label: 'Tutte' },
    { value: 'composizioni', label: 'Composizioni' },
    { value: 'animali', label: 'Animali' },
    { value: 'elementi-botanici', label: 'Elementi Botanici' },
    { value: 'insetti', label: 'Insetti' },
  ];

  readonly galleryItems: GalleryItem[] = this.buildGalleryItems();

  private buildGalleryItems(): GalleryItem[] {
    const items: GalleryItem[] = [];
    (Object.keys(PORTFOLIO_RAW_FILES) as GalleryCategory[]).forEach((category) => {
      const { folder, files } = PORTFOLIO_RAW_FILES[category];
      files.forEach((relativePath) => {
        const fileName = relativePath.split('/').pop()!;
        items.push({
          src: `images/${folder}/${relativePath}`,
          title: titleFromFileName(fileName),
          category,
          featured: category === 'composizioni',
        });
      });
    });
    return items;
  }
}
