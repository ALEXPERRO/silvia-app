import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SupabaseService, BookingSubmission } from '../../core/services/supabase.service';
import { EmailService } from '../../core/services/email.service';
import { PaintEventWithSeats } from '../../core/models/event.model';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-prenotazione-form',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, Icon, TranslatePipe],
  templateUrl: './prenotazione-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrenotazioneForm {
  private readonly supabase = inject(SupabaseService);
  private readonly emailService = inject(EmailService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  private readonly _events = signal<PaintEventWithSeats[]>([]);
  @Input({ required: true }) set events(value: PaintEventWithSeats[]) {
    this._events.set(value);
  }
  get events(): PaintEventWithSeats[] {
    return this._events();
  }

  /** true nella pagina Eventi (più eventi tra cui scegliere), false nella
   *  pagina dedicata di un singolo evento (già fissato, niente menu). */
  @Input() showEventSelector = true;

  @Input() set preselectedEventId(id: number | null) {
    if (id == null) return;
    this.form.controls.eventId.setValue(id);
    this.bookingSuccess.set(false);
    this.errorMessage.set(null);
  }

  @Output() readonly bookingCompleted = new EventEmitter<void>();

  @ViewChild('privacyNotice') private privacyNoticeRef?: ElementRef<HTMLDivElement>;

  protected readonly showPrivacyNotice = signal(false);
  protected readonly submitting = signal(false);
  protected readonly bookingSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currentStep = signal<1 | 2>(1);

  protected readonly form = this.fb.nonNullable.group({
    eventId: this.fb.control<number | null>(null, Validators.required),
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    numeroPosti: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    billingType: this.fb.control<'privato' | 'business'>('privato', Validators.required),
    cf: [''],
    companyName: [''],
    companyPiva: [''],
    companySdi: [''],
    address: ['', Validators.required],
    cap: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
    city: ['', Validators.required],
    privacyAccepted: [false, Validators.requiredTrue],
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
    return c.eventId.valid && c.name.valid && c.email.valid && c.numeroPosti.valid;
  });

  protected readonly step2Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    const billingValid = this.isPrivato() ? c.cf.valid : c.companyName.valid && c.companyPiva.valid && c.companySdi.valid;
    return billingValid && c.address.valid && c.cap.valid && c.city.valid;
  });

  protected readonly selectedEvent = computed(() => {
    const id = this.selectedEventId();
    return this._events().find((ev) => ev.id === id) ?? null;
  });

  constructor() {
    this.toggleBillingValidators(true);
    this.form.controls.billingType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.toggleBillingValidators(type === 'privato');
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

  goToStep2(): void {
    if (!this.step1Complete()) {
      const { eventId, name, email, numeroPosti } = this.form.controls;
      [eventId, name, email, numeroPosti].forEach((c) => c.markAsTouched());
      this.errorMessage.set(this.translate.instant('PRENOTAZIONE_FORM.ERR_INVALID_FIELDS'));
      return;
    }
    this.errorMessage.set(null);
    this.currentStep.set(2);
  }

  goToStep1(): void {
    this.errorMessage.set(null);
    this.currentStep.set(1);
  }

  openPrivacyNotice(): void {
    this.showPrivacyNotice.set(true);
    setTimeout(() => this.privacyNoticeRef?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
  }

  togglePrivacyNotice(): void {
    this.showPrivacyNotice.update((v) => !v);
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set(this.translate.instant('PRENOTAZIONE_FORM.ERR_INVALID_FIELDS'));
      return;
    }

    const eventId = this.form.controls.eventId.value!;
    const matchingEvent = this.selectedEvent();
    const currentSeats = matchingEvent?.seatsAvailable ?? 0;
    const numeroPosti = Math.round(this.form.controls.numeroPosti.value);

    if (currentSeats < numeroPosti) {
      const postiParola =
        currentSeats === 1
          ? this.translate.instant('PRENOTAZIONE_FORM.ERR_SEATS_SINGULAR')
          : this.translate.instant('PRENOTAZIONE_FORM.ERR_SEATS_PLURAL');
      this.errorMessage.set(
        this.translate.instant('PRENOTAZIONE_FORM.ERR_NOT_ENOUGH_SEATS', { count: currentSeats, word: postiParola }),
      );
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    const isPrivato = v.billingType === 'privato';

    const payload: BookingSubmission = {
      evento_titolo: matchingEvent?.title ?? 'Evento sconosciuto',
      nome_completo: v.name,
      email: v.email,
      numero_posti: numeroPosti,
      codice_fiscale: isPrivato ? v.cf || null : null,
      ragione_sociale: isPrivato ? null : v.companyName || null,
      partita_iva: isPrivato ? null : v.companyPiva || null,
      sdi: isPrivato ? null : v.companySdi || null,
      indirizzo: v.address,
      cap: v.cap,
      citta: v.city,
    };

    const { success, error } = await this.supabase.prenotaPosto(eventId, payload);
    if (error) {
      console.error(error);
      this.errorMessage.set(this.translate.instant('PRENOTAZIONE_FORM.ERR_GENERIC'));
      this.submitting.set(false);
      return;
    }
    if (!success) {
      this.errorMessage.set(this.translate.instant('PRENOTAZIONE_FORM.ERR_SOLD_OUT_RACE'));
      this.submitting.set(false);
      this.bookingCompleted.emit();
      return;
    }

    this.submitting.set(false);
    this.bookingSuccess.set(true);
    this.bookingCompleted.emit();
    this.form.reset({ billingType: 'privato', numeroPosti: 1 });
    this.currentStep.set(1);
    // Non blocca la UI: il posto è già confermato, l'invio email è un
    // effetto collaterale e non deve ritardare il messaggio di successo.
    void this.emailService.sendBookingEmails(payload);
  }
}
