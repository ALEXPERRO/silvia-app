import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_ITEMS } from '../nav-items';
import { Icon } from '../../shared/icon/icon';

/** Oltre questa soglia di scroll (px) la barra si riduce a un cerchio. */
const COLLAPSE_THRESHOLD = 24;

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './bottom-nav.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  protected readonly navItems = NAV_ITEMS;
  protected readonly collapsed = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      // Ricalcola ad ogni scroll: un tap su "espandi" la riapre solo finché
      // l'utente non ricomincia a scorrere, poi torna a ridursi da sola.
      const onScroll = () => {
        this.collapsed.set(window.scrollY > COLLAPSE_THRESHOLD);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
    });
  }

  expand(): void {
    this.collapsed.set(false);
  }
}
