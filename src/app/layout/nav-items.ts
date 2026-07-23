export interface NavItem {
  labelKey: string;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'NAV.ABOUT', path: '/' },
  { labelKey: 'NAV.PORTFOLIO', path: '/portfolio' },
  { labelKey: 'NAV.EVENTI', path: '/eventi' },
  { labelKey: 'NAV.SHOP', path: '/shop' },
];
