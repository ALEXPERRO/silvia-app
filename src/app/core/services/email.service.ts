import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BookingSubmission } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class EmailService {
  // Import dinamico come per @supabase/supabase-js: evita di appesantire il
  // bundle iniziale con una libreria usata solo dopo una prenotazione riuscita.
  private clientPromise: Promise<typeof import('@emailjs/browser')> | null = null;

  private getClient(): Promise<typeof import('@emailjs/browser')> {
    if (!this.clientPromise) {
      this.clientPromise = import('@emailjs/browser');
    }
    return this.clientPromise;
  }

  /**
   * Invia le due email di conferma prenotazione (cliente + notifica a Silvia)
   * via EmailJS. Non deve mai far fallire la prenotazione: il posto è già
   * salvato nel database quando questo metodo viene chiamato, l'email è un
   * effetto collaterale non critico — gli errori vengono solo loggati.
   */
  async sendBookingEmails(payload: BookingSubmission): Promise<void> {
    const params = {
      title: payload.evento_titolo,
      evento_titolo: payload.evento_titolo,
      nome_completo: payload.nome_completo,
      email_cliente: payload.email,
      indirizzo: payload.indirizzo,
      cap: payload.cap,
      citta: payload.citta,
      codice_fiscale: payload.codice_fiscale ?? '',
      ragione_sociale: payload.ragione_sociale ?? '',
      partita_iva: payload.partita_iva ?? '',
      sdi: payload.sdi ?? '',
    };

    try {
      const emailjs = await this.getClient();
      const options = { publicKey: environment.emailjs.publicKey };
      const results = await Promise.allSettled([
        emailjs.send(environment.emailjs.serviceId, environment.emailjs.templateCliente, params, options),
        emailjs.send(environment.emailjs.serviceId, environment.emailjs.templateOrganizzatore, params, options),
      ]);
      results.forEach((r) => {
        if (r.status === 'rejected') console.error('Invio email di prenotazione fallito:', r.reason);
      });
    } catch (err) {
      console.error('Invio email di prenotazione fallito:', err);
    }
  }
}
