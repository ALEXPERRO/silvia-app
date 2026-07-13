export interface NavItem {
  label: string;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'About me', path: '/' },
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Eventi', path: '/eventi' },
  { label: 'Shop', path: '/shop' },
];
