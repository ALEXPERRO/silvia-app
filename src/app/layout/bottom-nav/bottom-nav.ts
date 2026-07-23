import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { NAV_ITEMS } from '../nav-items';
import { Icon } from '../../shared/icon/icon';

/** Oltre questa soglia di scroll (px) la barra si riduce a un cerchio. */
const COLLAPSE_THRESHOLD = 24;

/** Quantità minima (px) di scroll continuo verso l'alto prima di riaprire
 *  la barra: evita che un dito che oscilla leggermente durante la lettura
 *  la faccia sfarfallare aperta/chiusa. */
const UP_REVEAL_THRESHOLD = 14;

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
  private lastY = 0;
  private upAccum = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const router = inject(Router);

    afterNextRender(() => {
      this.lastY = window.scrollY;

      // Si nasconde scorrendo giù, si riapre scorrendo su di almeno
      // UP_REVEAL_THRESHOLD px consecutivi (o tornando in cima, o con un tap).
      const onScroll = () => {
        if (this.ignoreScroll) return;
        const y = window.scrollY;
        const delta = y - this.lastY;
        this.lastY = y;

        if (y < COLLAPSE_THRESHOLD) {
          this.upAccum = 0;
          this.collapsed.set(false);
          return;
        }

        if (delta > 0) {
          this.upAccum = 0;
          this.collapsed.set(true);
        } else if (delta < 0) {
          this.upAccum -= delta;
          if (this.upAccum > UP_REVEAL_THRESHOLD) {
            this.collapsed.set(false);
          }
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));

      const navSub = router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
        // Il cambio pagina riporta lo scroll in cima da solo (vedi
        // withInMemoryScrolling): non è uno scroll dell'utente, quindi non
        // deve far lampeggiare la barra.
        this.ignoreScroll = true;
        this.upAccum = 0;
        this.collapsed.set(false);
        setTimeout(() => {
          this.lastY = window.scrollY;
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
