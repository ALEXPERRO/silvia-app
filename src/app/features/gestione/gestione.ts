import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Prenotazione } from '../../core/models/prenotazione.model';

@Component({
  selector: 'app-gestione',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, NgClass],
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

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
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
    await this.admin.signOut();
    this.authenticated.set(false);
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
}
