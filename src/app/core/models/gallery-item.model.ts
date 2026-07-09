export type GalleryCategory =
  | 'composizioni'
  | 'animali'
  | 'elementi-botanici'
  | 'elementi-marini'
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
