export interface GalleryItem {
  id: number;
  src: string;
  title: string;
  category: string;
  ordine: number;
}

export interface GalleryCategoryOption {
  value: string;
  label: string;
}

/** Vista admin di un'immagine portfolio: espone anche lo stato di pubblicazione,
 *  che il pubblico non deve mai vedere/gestire. */
export interface GalleryItemAdmin extends GalleryItem {
  pubblicato: boolean;
}
