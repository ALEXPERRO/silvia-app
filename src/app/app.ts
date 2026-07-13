import { ChangeDetectionStrategy, Component, NgZone, afterNextRender, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { Footer } from './layout/footer/footer';

/** Ordine delle sezioni per la navigazione a swipe su mobile (stesso ordine della navbar). */
const SWIPE_ROUTES = ['/', '/portfolio', '/eventi', '/shop'];

/** Sotto questa larghezza lo swipe tra sezioni è attivo. */
const MOBILE_MAX_WIDTH = 768;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  private touchStartX = 0;
  private touchStartY = 0;
  private swipeArmed = false;

  constructor() {
    afterNextRender(() => {
      // fuori da Angular: niente change detection ad ogni tocco
      this.zone.runOutsideAngular(() => {
        this.document.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
        this.document.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });
      });
    });
  }

  private onTouchStart(event: TouchEvent): void {
    this.swipeArmed =
      event.touches.length === 1 &&
      (this.document.defaultView?.innerWidth ?? Infinity) < MOBILE_MAX_WIDTH &&
      !this.ownsHorizontalGesture(event.target);
    if (!this.swipeArmed) return;
    this.touchStartX = event.changedTouches[0].clientX;
    this.touchStartY = event.changedTouches[0].clientY;
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.swipeArmed) return;
    this.swipeArmed = false;
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    const dy = event.changedTouches[0].clientY - this.touchStartY;
    // solo gesti nettamente orizzontali, per non confondere lo swipe con scroll o tap
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const currentPath = this.router.url.split('?')[0].split('#')[0];
    const index = SWIPE_ROUTES.indexOf(currentPath);
    if (index === -1) return;
    const target = SWIPE_ROUTES[dx < 0 ? index + 1 : index - 1];
    if (!target) return;

    this.zone.run(() => this.router.navigateByUrl(target));
  }

  /** True se il tocco parte da un elemento che gestisce già i gesti orizzontali
   *  (slider scrollabili, lightbox) e non deve cambiare sezione. */
  private ownsHorizontalGesture(target: EventTarget | null): boolean {
    let el = target instanceof Element ? target : null;
    while (el && el !== this.document.body) {
      if (el.hasAttribute('data-no-swipe-nav')) return true;
      const { overflowX } = getComputedStyle(el);
      if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
      el = el.parentElement;
    }
    return false;
  }
}
