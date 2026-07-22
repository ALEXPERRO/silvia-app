import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { NAV_ITEMS } from '../nav-items';
import { Icon } from '../../shared/icon/icon';

/** Oltre questa soglia di scroll (px) la barra si riduce a un cerchio. */
const COLLAPSE_THRESHOLD = 24;

/** Durata (ms) di silenzio dopo un cambio pagina: ignora lo scroll fatto
 *  da Angular per riposizionare la pagina in cima, per evitare che la barra
 *  lampeggi (si riduce e riapre) durante la navigazione. */
const NAVIGATION_SETTLE_MS = 300;

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

  private ignoreScroll = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const router = inject(Router);

    afterNextRender(() => {
      // Ricalcola ad ogni scroll: un tap su "espandi" la riapre solo finché
      // l'utente non ricomincia a scorrere, poi torna a ridursi da sola.
      const onScroll = () => {
        if (this.ignoreScroll) return;
        this.collapsed.set(window.scrollY > COLLAPSE_THRESHOLD);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));

      const navSub = router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
        // Il cambio pagina riporta lo scroll in cima da solo (vedi
        // withInMemoryScrolling): non è uno scroll dell'utente, quindi non
        // deve far lampeggiare la barra.
        this.ignoreScroll = true;
        this.collapsed.set(false);
        setTimeout(() => {
          this.ignoreScroll = false;
        }, NAVIGATION_SETTLE_MS);
      });
      destroyRef.onDestroy(() => navSub.unsubscribe());
    });
  }

  expand(): void {
    this.collapsed.set(false);
  }
}
