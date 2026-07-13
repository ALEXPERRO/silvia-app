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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, Meta, SafeResourceUrl } from '@angular/platform-browser';
import { NgClass } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { SupabaseService, BookingSubmission } from '../../core/services/supabase.service';
import { PaintEventWithSeats } from '../../core/models/event.model';
import { Icon } from '../../shared/icon/icon';

const DEFAULT_SEATS = 10;

@Component({
  selector: 'app-eventi',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, Icon],
  templateUrl: './eventi.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Eventi {
  private readonly content = inject(ContentService);
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly trustedUrlCache = new Map<string, SafeResourceUrl>();

  @ViewChild('sliderRef') private sliderRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bookingSection') private bookingSectionRef?: ElementRef<HTMLDivElement>;

  protected readonly events = this.content.events;

  private readonly seats = signal<Record<number, number>>({});
  protected readonly seatsLoaded = signal(false);
  protected readonly currentIndex = signal(0);
  protected readonly showSwipeHint = signal(true);
  protected readonly showBookingSection = signal(false);
  protected readonly submitting = signal(false);
  protected readonly bookingSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly eventsWithSeats = computed<PaintEventWithSeats[]>(() => {
    const seatMap = this.seats();
    return this.events.map((ev) => {
      const seatsAvailable = seatMap[ev.id] ?? DEFAULT_SEATS;
      return { ...ev, seatsAvailable, isSoldOut: seatsAvailable <= 0 };
    });
  });

  protected readonly form = this.fb.nonNullable.group({
    eventId: this.fb.control<number | null>(null, Validators.required),
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    billingType: this.fb.control<'privato' | 'business'>('privato', Validators.required),
    cf: [''],
    companyName: [''],
    companyPiva: [''],
    companySdi: [''],
    address: ['', Validators.required],
    cap: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
    city: ['', Validators.required],
  });

  private readonly billingType = toSignal(this.form.controls.billingType.valueChanges, {
    initialValue: 'privato' as const,
  });
  private readonly selectedEventId = toSignal(this.form.controls.eventId.valueChanges, { initialValue: null });

  protected readonly isPrivato = computed(() => this.billingType() === 'privato');

  private readonly formStatus = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly step1Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    return c.eventId.valid && c.name.valid && c.email.valid;
  });

  protected readonly step2Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    const billingValid = this.isPrivato() ? c.cf.valid : c.companyName.valid && c.companyPiva.valid && c.companySdi.valid;
    return billingValid && c.address.valid && c.cap.valid && c.city.valid;
  });

  protected readonly selectedEvent = computed(() => {
    const id = this.selectedEventId();
    return this.eventsWithSeats().find((ev) => ev.id === id) ?? null;
  });

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Workshop e appuntamenti di pittura ad acquerello con Silvia Sgaramella: scopri le prossime date e prenota il tuo posto.',
    });

    this.toggleBillingValidators(true);
    this.form.controls.billingType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.toggleBillingValidators(type === 'privato');
    });

    afterNextRender(() => {
      // di norma risolve subito: la cache è già stata scaldata all'avvio (vedi App)
      this.supabase.getEventSeats().then((seatMap) => {
        this.seats.set(seatMap);
        this.seatsLoaded.set(true);
      });
    });
  }

  private toggleBillingValidators(isPrivato: boolean): void {
    const { cf, companyName, companyPiva, companySdi } = this.form.controls;
    if (isPrivato) {
      cf.setValidators([Validators.required]);
      companyName.clearValidators();
      companyPiva.clearValidators();
      companySdi.clearValidators();
    } else {
      cf.clearValidators();
      companyName.setValidators([Validators.required]);
      companyPiva.setValidators([Validators.required, Validators.pattern(/^[0-9]{11}$/)]);
      companySdi.setValidators([Validators.required]);
    }
    [cf, companyName, companyPiva, companySdi].forEach((c) => c.updateValueAndValidity({ emitEvent: false }));
  }

  trustedMapUrl(url: string): SafeResourceUrl {
    let trusted = this.trustedUrlCache.get(url);
    if (!trusted) {
      trusted = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.trustedUrlCache.set(url, trusted);
    }
    return trusted;
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
    this.form.controls.eventId.setValue(eventId);
    this.showBookingSection.set(true);
    setTimeout(() => this.bookingSectionRef?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Controlla i campi evidenziati in rosso: alcuni dati mancano o non sono validi.');
      return;
    }

    const eventId = this.form.controls.eventId.value!;
    const currentSeats = this.seats()[eventId] ?? DEFAULT_SEATS;
    const matchingEvent = this.events.find((ev) => ev.id === eventId);

    if (currentSeats <= 0) {
      this.errorMessage.set('Ops! I posti per questo evento si sono esauriti un istante fa.');
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    const isPrivato = v.billingType === 'privato';

    const payload: BookingSubmission = {
      evento_titolo: matchingEvent?.title ?? 'Evento sconosciuto',
      nome_completo: v.name,
      email: v.email,
      codice_fiscale: isPrivato ? v.cf || null : null,
      ragione_sociale: isPrivato ? null : v.companyName || null,
      partita_iva: isPrivato ? null : v.companyPiva || null,
      sdi: isPrivato ? null : v.companySdi || null,
      indirizzo: v.address,
      cap: v.cap,
      citta: v.city,
    };

    const { error: insertError } = await this.supabase.insertBooking(payload);
    if (insertError) {
      console.error(insertError);
      this.errorMessage.set('Si è verificato un problema con la registrazione. Riprova.');
      this.submitting.set(false);
      return;
    }

    const { error: updateError } = await this.supabase.decrementSeats(eventId, currentSeats - 1);
    if (updateError) {
      console.error('Errore aggiornamento contatore posti:', updateError);
    }

    this.seats.update((s) => ({ ...s, [eventId]: currentSeats - 1 }));
    this.submitting.set(false);
    this.bookingSuccess.set(true);
    this.form.reset({ billingType: 'privato' });
  }
}
