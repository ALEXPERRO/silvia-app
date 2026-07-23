import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { PaintEventWithSeats } from '../../core/models/event.model';
import { buildEventoUrl, isEventoPassato, DEFAULT_SEATS, SITE_URL } from '../../core/utils/event-format.util';
import { Icon } from '../../shared/icon/icon';
import { PrenotazioneForm } from '../../shared/prenotazione-form/prenotazione-form';

@Component({
  selector: 'app-evento-dettaglio',
  standalone: true,
  imports: [DecimalPipe, RouterLink, Icon, PrenotazioneForm, TranslatePipe],
  templateUrl: './evento-dettaglio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventoDettaglio {
  private readonly supabase = inject(SupabaseService);
  private readonly resolvedEvent = inject(ActivatedRoute).snapshot.data['event'] as PaintEventWithSeats;

  protected readonly seatsAvailable = signal(this.resolvedEvent.seatsAvailable);
  protected readonly isPast = isEventoPassato(this.resolvedEvent.data, this.resolvedEvent.oraFine);

  protected readonly event = computed<PaintEventWithSeats>(() => ({
    ...this.resolvedEvent,
    seatsAvailable: this.seatsAvailable(),
    isSoldOut: this.seatsAvailable() <= 0,
  }));

  constructor() {
    const meta = inject(Meta);
    const title = inject(Title);
    const ev = this.resolvedEvent;

    const pageTitle = `${ev.title} — Blooming Wild ART`;
    const url = buildEventoUrl(ev.title, ev.id);
    const image = ev.locandinaUrl ?? `${SITE_URL}/images/og-card.webp`;
    const description = `${ev.dateLabel} · ${ev.luogo} — ${ev.descrizione}`.slice(0, 200);

    title.setTitle(pageTitle);
    meta.updateTag({ name: 'description', content: description });
    meta.updateTag({ property: 'og:title', content: pageTitle });
    meta.updateTag({ property: 'og:description', content: description });
    meta.updateTag({ property: 'og:image', content: image });
    meta.updateTag({ property: 'og:url', content: url });
    meta.updateTag({ name: 'twitter:title', content: pageTitle });
    meta.updateTag({ name: 'twitter:description', content: description });
    meta.updateTag({ name: 'twitter:image', content: image });
  }

  onBookingCompleted(): void {
    this.supabase.getEventSeats().then((seatMap) => {
      this.seatsAvailable.set(seatMap[this.resolvedEvent.id] ?? DEFAULT_SEATS);
    });
  }
}
