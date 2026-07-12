export type GalleryCategory =
  | 'composizioni'
  | 'animali'
  | 'elementi-botanici'
  | 'insetti';

export interface GalleryItem {
  src: string;
  title: string;
  category: GalleryCategory;
  featured: boolean;
}

export interface GalleryCategoryOption {
  value: GalleryCategory | 'tutte';
  label: string;
}
