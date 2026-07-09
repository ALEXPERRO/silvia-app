import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  protected readonly navItems: NavItem[] = [
    { label: 'About me', path: '/' },
    { label: 'Portfolio', path: '/portfolio' },
    { label: 'Eventi', path: '/eventi' },
    { label: 'Shop', path: '/shop' },
  ];
}
