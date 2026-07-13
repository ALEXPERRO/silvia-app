import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_ITEMS } from '../nav-items';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  protected readonly navItems = NAV_ITEMS;
}
