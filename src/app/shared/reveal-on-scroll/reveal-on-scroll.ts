import { Directive, ElementRef, Renderer2, DestroyRef, afterNextRender, inject } from '@angular/core';

@Directive({
  selector: '[appRevealOnScroll]',
  standalone: true,
  host: {
    class: 'reveal-on-scroll',
  },
})
export class RevealOnScroll {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const target = this.el.nativeElement;

      if (typeof IntersectionObserver === 'undefined') {
        this.renderer.addClass(target, 'is-visible');
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.renderer.addClass(target, 'is-visible');
              observer.unobserve(target);
            }
          }
        },
        { threshold: 0.15 },
      );

      observer.observe(target);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
