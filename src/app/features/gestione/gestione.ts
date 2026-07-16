import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Prenotazione } from '../../core/models/prenotazione.model';
import { EventFormValue, PaintEventAdmin } from '../../core/models/event.model';
import { formatFasciaOraria } from '../../core/utils/event-format.util';

@Component({
  selector: 'app-gestione',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, NgClass],
  templateUrl: './gestione.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gestione {
  private readonly admin = inject(AdminService);
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  protected readonly checkingSession = signal(true);
  protected readonly authenticated = signal(false);
  protected readonly loginError = signal<string | null>(null);
  protected readonly signingIn = signal(false);
  protected readonly bookings = signal<Prenotazione[]>([]);
  protected readonly seats = signal<Record<number, number>>({});
  protected readonly showCancelled = signal(false);
  protected readonly confirmingCancelId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly activeTab = signal<'prenotazioni' | 'eventi'>('prenotazioni');
  protected readonly adminEvents = signal<PaintEventAdmin[]>([]);
  protected readonly eventsTabLoaded = signal(false);
  protected readonly eventActionError = signal<string | null>(null);
  // riusa la stessa utility della pagina pubblica Eventi (Fase 1) invece di
  // duplicare la logica di formattazione orario nel template.
  protected readonly formatOrario = formatFasciaOraria;

  protected readonly showEventForm = signal(false);
  protected readonly editingEventId = signal<number | null>(null);
  protected readonly selectedLocandinaFile = signal<File | null>(null);
  protected readonly currentLocandinaUrl = signal<string | null>(null);
  protected readonly savingEvent = signal(false);
  protected readonly eventFormError = signal<string | null>(null);
  // mostrato nel form ("Di cui N già prenotati"), calcolato una volta all'apertura
  protected readonly giaPrenotatiCorrente = signal(0);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly eventForm = this.fb.nonNullable.group({
    titolo: ['', Validators.required],
    luogo: ['', Validators.required],
    indirizzo: ['', Validators.required],
    data: ['', Validators.required],
    oraInizio: ['', Validators.required],
    oraFine: ['', Validators.required],
    descrizione: ['', Validators.required],
    prezzo: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    capienzaTotale: this.fb.nonNullable.control(10, [Validators.required, Validators.min(0)]),
    pubblicato: [true],
  });

  protected readonly groupedBookings = computed(() => {
    const all = this.bookings();
    const showCancelled = this.showCancelled();
    const seatMap = this.seats();

    const groups = new Map<string, { titolo: string; postiDisponibili: number | null; prenotazioni: Prenotazione[] }>();
    for (const b of all) {
      if (b.cancellata && !showCancelled) continue;
      if (!groups.has(b.evento_titolo)) {
        const posti = b.evento_id !== null && seatMap[b.evento_id] !== undefined ? seatMap[b.evento_id] : null;
        groups.set(b.evento_titolo, { titolo: b.evento_titolo, postiDisponibili: posti, prenotazioni: [] });
      }
      groups.get(b.evento_titolo)!.prenotazioni.push(b);
    }
    return Array.from(groups.values());
  });

  constructor() {
    // pagina privata, non pensata per essere indicizzata o linkata
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });

    afterNextRender(() => {
      this.admin
        .getSession()
        .then((hasSession) => {
          this.authenticated.set(hasSession);
          if (hasSession) {
            this.loadData();
          }
        })
        .catch(() => {
          this.loginError.set('Impossibile contattare il server. Riprova.');
        })
        .finally(() => {
          this.checkingSession.set(false);
        });
    });
  }

  async onLogin(): Promise<void> {
    this.loginError.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.signingIn.set(true);
    const { email, password } = this.loginForm.getRawValue();
    try {
      const { error } = await this.admin.signIn(email, password);
      if (error) {
        this.loginError.set('Email o password non corretti.');
        return;
      }
      this.authenticated.set(true);
      this.loadData();
    } catch {
      this.loginError.set('Impossibile contattare il server. Riprova.');
    } finally {
      this.signingIn.set(false);
    }
  }

  async onLogout(): Promise<void> {
    try {
      await this.admin.signOut();
    } finally {
      this.authenticated.set(false);
    }
  }

  private loadData(): void {
    this.admin.getBookings().then((data) => this.bookings.set(data));
    this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
  }

  async togglePaid(booking: Prenotazione): Promise<void> {
    this.actionError.set(null);
    try {
      const { error } = await this.admin.setPaid(booking.id, !booking.pagato);
      if (error) {
        this.actionError.set('Impossibile aggiornare lo stato del pagamento. Riprova.');
        return;
      }
      this.bookings.update((list) =>
        list.map((b) => (b.id === booking.id ? { ...b, pagato: !booking.pagato } : b)),
      );
    } catch {
      this.actionError.set('Impossibile aggiornare lo stato del pagamento. Riprova.');
    }
  }

  armCancel(id: number): void {
    this.confirmingCancelId.set(id);
  }

  async confirmCancel(id: number): Promise<void> {
    this.actionError.set(null);
    try {
      const { success, error } = await this.admin.cancelBooking(id);
      if (error || !success) {
        this.actionError.set('Impossibile annullare la prenotazione. Riprova.');
        return;
      }
      this.bookings.update((list) => list.map((b) => (b.id === id ? { ...b, cancellata: true } : b)));
      this.supabase.invalidateSeatsCache();
      this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
    } catch {
      this.actionError.set('Impossibile annullare la prenotazione. Riprova.');
    } finally {
      this.confirmingCancelId.set(null);
    }
  }

  selectTab(tab: 'prenotazioni' | 'eventi'): void {
    this.activeTab.set(tab);
    if (tab === 'eventi' && !this.eventsTabLoaded()) {
      this.admin.getAllEvents().then((events) => {
        this.adminEvents.set(events);
        this.eventsTabLoaded.set(true);
      });
    }
  }

  /** Somma i posti delle prenotazioni attive (non annullate) collegate a un evento,
   *  riusando i dati già caricati per la scheda Prenotazioni (nessuna query extra). */
  private postiGiaPrenotati(eventoId: number): number {
    return this.bookings()
      .filter((b) => b.evento_id === eventoId && !b.cancellata)
      .reduce((sum, b) => sum + b.numero_posti, 0);
  }

  openNewEventForm(): void {
    this.editingEventId.set(null);
    this.eventFormError.set(null);
    this.selectedLocandinaFile.set(null);
    this.currentLocandinaUrl.set(null);
    this.giaPrenotatiCorrente.set(0);
    this.eventForm.reset({ prezzo: 0, capienzaTotale: 10, pubblicato: true });
    this.showEventForm.set(true);
  }

  openEditEventForm(ev: PaintEventAdmin): void {
    this.editingEventId.set(ev.id);
    this.eventFormError.set(null);
    this.selectedLocandinaFile.set(null);
    this.currentLocandinaUrl.set(ev.locandinaUrl);
    const giaPrenotati = this.postiGiaPrenotati(ev.id);
    this.giaPrenotatiCorrente.set(giaPrenotati);
    this.eventForm.reset({
      titolo: ev.title,
      luogo: ev.luogo,
      indirizzo: ev.indirizzo,
      data: ev.data,
      oraInizio: ev.oraInizio.slice(0, 5),
      oraFine: ev.oraFine.slice(0, 5),
      descrizione: ev.descrizione,
      prezzo: ev.prezzo,
      capienzaTotale: ev.postiTotali,
      pubblicato: ev.pubblicato,
    });
    this.showEventForm.set(true);
  }

  closeEventForm(): void {
    this.showEventForm.set(false);
  }

  onLocandinaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedLocandinaFile.set(input.files?.[0] ?? null);
  }

  async toggleEventoPubblicato(ev: PaintEventAdmin): Promise<void> {
    this.eventActionError.set(null);
    try {
      const { error } = await this.admin.togglePubblicato(ev.id, !ev.pubblicato);
      if (error) {
        this.eventActionError.set("Impossibile aggiornare lo stato dell'evento. Riprova.");
        return;
      }
      this.adminEvents.update((list) =>
        list.map((e) => (e.id === ev.id ? { ...e, pubblicato: !ev.pubblicato } : e)),
      );
    } catch {
      this.eventActionError.set("Impossibile aggiornare lo stato dell'evento. Riprova.");
    }
  }

  async onSubmitEvent(): Promise<void> {
    this.eventFormError.set(null);
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      this.eventFormError.set('Controlla i campi evidenziati: alcuni dati mancano o non sono validi.');
      return;
    }

    const editingId = this.editingEventId();
    const giaPrenotati = editingId !== null ? this.postiGiaPrenotati(editingId) : 0;
    const v = this.eventForm.getRawValue();
    const postiDisponibili = v.capienzaTotale - giaPrenotati;

    if (postiDisponibili < 0) {
      this.eventFormError.set(
        `Ci sono già ${giaPrenotati} persone prenotate: non puoi impostare meno di ${giaPrenotati} posti totali.`,
      );
      return;
    }

    this.savingEvent.set(true);
    try {
      let locandinaUrl = this.currentLocandinaUrl();

      const file = this.selectedLocandinaFile();
      if (file) {
        const { url, error } = await this.admin.uploadLocandina(file);
        if (error) {
          this.eventFormError.set('Impossibile caricare la locandina. Riprova.');
          return;
        }
        locandinaUrl = url;
      }

      const fields: EventFormValue = { ...v, locandinaUrl };
      const { error } = editingId !== null
        ? await this.admin.updateEvent(editingId, fields, postiDisponibili)
        : await this.admin.createEvent(fields, postiDisponibili);

      if (error) {
        this.eventFormError.set("Impossibile salvare l'evento. Riprova.");
        return;
      }

      this.showEventForm.set(false);
      this.eventsTabLoaded.set(false);
      this.selectTab('eventi');
    } catch {
      this.eventFormError.set("Impossibile salvare l'evento. Riprova.");
    } finally {
      this.savingEvent.set(false);
    }
  }
}
