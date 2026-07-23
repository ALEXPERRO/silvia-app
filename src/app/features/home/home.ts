import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { ContentService } from '../../core/services/content.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PaintEvent } from '../../core/models/event.model';
import { formatDataItaliana, formatFasciaOraria } from '../../core/utils/event-format.util';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, Icon, TranslatePipe],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);
  private readonly supabase = inject(SupabaseService);

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Blooming Wild ART — le illustrazioni ad acquerello di Silvia Sgaramella: flora, fauna e piccole magie botaniche. Scopri portfolio, workshop e shop.',
    });

    afterNextRender(() => {
      this.supabase.getPublishedEvents().then((events) => {
        const oggi = new Date().toISOString().slice(0, 10);
        this.nextEvent.set(events.find((ev) => ev.data >= oggi) ?? null);
        this.eventsLoaded.set(true);
      });
    });
  }

  protected readonly cover = this.content.cover;
  protected readonly nextEvent = signal<PaintEvent | null>(null);
  protected readonly eventsLoaded = signal(false);
  protected readonly nextEventDisplay = computed(() => {
    const ev = this.nextEvent();
    if (!ev) return null;
    return { ...ev, dateLabel: formatDataItaliana(ev.data), timeLabel: formatFasciaOraria(ev.oraInizio, ev.oraFine) };
  });
  protected readonly portfolioPreview = [
    'images/animali/volpe1.webp',
    'images/animali/kingfisher.webp',
    'images/elementi botanici/giglio2.webp',
    'images/insetti/farfalle colorate/farfalla colorata1.webp',
  ];
}
