import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { DecimalPipe, NgClass } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { PaintEvent, PaintEventWithSeats } from '../../core/models/event.model';
import { formatDataItaliana, formatFasciaOraria, buildMapsUrl, DEFAULT_SEATS } from '../../core/utils/event-format.util';
import { Icon } from '../../shared/icon/icon';
import { PrenotazioneForm } from '../../shared/prenotazione-form/prenotazione-form';

@Component({
  selector: 'app-eventi',
  standalone: true,
  imports: [NgClass, DecimalPipe, Icon, PrenotazioneForm],
  templateUrl: './eventi.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Eventi {
  private readonly supabase = inject(SupabaseService);

  @ViewChild('sliderRef') private sliderRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bookingSection') private bookingSectionRef?: ElementRef<HTMLDivElement>;

  protected readonly events = signal<PaintEvent[]>([]);
  protected readonly eventsLoaded = signal(false);

  private readonly seats = signal<Record<number, number>>({});
  protected readonly seatsLoaded = signal(false);
  protected readonly currentIndex = signal(0);
  protected readonly showSwipeHint = signal(true);
  protected readonly showBookingSection = signal(false);
  protected readonly preselectedEventId = signal<number | null>(null);

  protected readonly eventsWithSeats = computed<PaintEventWithSeats[]>(() => {
    const seatMap = this.seats();
    return this.events().map((ev) => {
      const seatsAvailable = seatMap[ev.id] ?? DEFAULT_SEATS;
      return {
        ...ev,
        seatsAvailable,
        isSoldOut: seatsAvailable <= 0,
        dateLabel: formatDataItaliana(ev.data),
        timeLabel: formatFasciaOraria(ev.oraInizio, ev.oraFine),
        mapsUrl: buildMapsUrl(ev.luogo, ev.indirizzo),
      };
    });
  });

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Workshop e appuntamenti di pittura ad acquerello con Silvia Sgaramella: scopri le prossime date e prenota il tuo posto.',
    });

    afterNextRender(() => {
      // di norma risolve subito: la cache è già stata scaldata all'avvio (vedi App)
      this.supabase.getEventSeats().then((seatMap) => {
        this.seats.set(seatMap);
        this.seatsLoaded.set(true);
      });
      this.supabase.getPublishedEvents().then((events) => {
        this.events.set(events);
        this.eventsLoaded.set(true);
      });
    });
  }

  scrollToNext(): void {
    const el = this.sliderRef?.nativeElement;
    el?.scrollBy({ left: el.getBoundingClientRect().width, behavior: 'smooth' });
  }

  scrollToPrev(): void {
    const el = this.sliderRef?.nativeElement;
    el?.scrollBy({ left: -el.getBoundingClientRect().width, behavior: 'smooth' });
  }

  onSliderScroll(event: Event): void {
    this.showSwipeHint.set(false);
    const el = event.target as HTMLDivElement;
    const width = el.getBoundingClientRect().width;
    if (width > 0) {
      this.currentIndex.set(Math.round(el.scrollLeft / width));
    }
  }

  goToSlide(index: number): void {
    const el = this.sliderRef?.nativeElement;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    el.scrollTo({ left: index * width, behavior: 'smooth' });
  }

  selectEventAndScroll(eventId: number): void {
    this.preselectedEventId.set(eventId);
    this.showBookingSection.set(true);
    setTimeout(() => this.bookingSectionRef?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
  }

  onBookingCompleted(): void {
    this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
  }
}
