# Pagina dedicata per evento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni evento pubblicato ottiene una pagina dedicata su `/eventi/:slug-id`,
condivisibile su Instagram con anteprima corretta (titolo + locandina), con
prenotazione diretta sulla pagina. Silvia recupera il link da un bottone "Copia
link" nel pannello Gestione.

**Architecture:** Nuova route `eventi/:slugId` renderizzata lato server ad ogni
richiesta (`RenderMode.Server`), risolta da un Angular `resolve` (non da
`afterNextRender`, che viene saltato in SSR) che recupera l'evento da Supabase e
usa `RedirectCommand` per rimandare a `/eventi` se l'id non è valido o l'evento
non è pubblicato — Angular converte questo in un vero redirect HTTP quando
avviene durante il render server-side. Il form di prenotazione, oggi tutto
dentro `eventi.ts`/`.html`, viene estratto in un componente condiviso
`PrenotazioneForm`, usato sia dalla pagina Eventi (slider, invariata) sia dalla
nuova pagina dedicata.

**Tech Stack:** Angular 20 standalone components/signals, Angular Router
(`ResolveFn`, `RedirectCommand`), `@angular/ssr` (`RenderMode.Server`),
`@angular/platform-browser` (`Meta`, `Title`), Supabase, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-07-18-evento-pagina-dedicata-design.md` —
legge quello per il contesto delle decisioni; qui sotto il codice esatto.

## Global Constraints

- Formato URL: `/eventi/{slug}-{id}` (es. `/eventi/workshop-acquerello-a-firenze-42`).
  Il lookup dell'evento usa **solo l'id** (ultimo blocco di cifre nello slug
  param) — la parte testuale non viene mai validata. Utility:
  `buildEventoSlug`/`buildEventoUrl`/`parseEventoId` in
  `src/app/core/utils/event-format.util.ts` (Task 1), usate ovunque serva
  costruire o leggere questo formato — nessun altro punto del codice deve
  duplicare questa logica.
- Rendering: `eventi/:slugId` è `RenderMode.Server` in `app.routes.server.ts`
  (Task 6) — non `Prerender` come le altre pagine pubbliche. Il fetch dati
  avviene in un `resolve` di rotta (Task 5), mai in `afterNextRender` (che è
  no-op lato server e vanificherebbe l'anteprima Open Graph).
- Redirect per id non valido / evento non trovato / non pubblicato: sempre e
  solo `/eventi`, tramite `RedirectCommand` restituito dal resolver — non un
  `router.navigate` dentro il componente (il componente non deve mai istanziarsi
  con un evento nullo).
- Evento passato (data+ora fine già trascorse) ma ancora pubblicato: pagina
  raggiungibile, tutti i dettagli visibili, ma al posto di `PrenotazioneForm`
  compare il messaggio "Evento concluso". Utility: `isEventoPassato` (Task 1).
- Il bottone per recuperare il link (`buildEventoUrl`) vive **solo** nella
  scheda Eventi del pannello Gestione (Task 7) — non sulla pagina pubblica
  Eventi, per decisione esplicita.
- Meta tag Open Graph/Twitter (`og:title`, `og:description`, `og:image`,
  `og:url`, `twitter:title`, `twitter:description`, `twitter:image`) impostati
  nel costruttore di `EventoDettaglio` via `Meta.updateTag` — stesso pattern già
  usato per `name: 'description'` in `eventi.ts`/`home.ts`/`portfolio.ts`/
  `shop.ts`, qui esteso ai tag `og:*`/`twitter:*`. Titolo pagina/anteprima
  esatto: `` `${titolo evento} — Blooming Wild ART` ``. Immagine: `locandinaUrl`
  dell'evento, fallback `` `${SITE_URL}/images/og-card.webp` `` se assente.
- `PrenotazioneForm` deve riprodurre **esattamente** la logica di prenotazione
  oggi in `eventi.ts` (validazioni, due step, toggle privato/business, gestione
  posti esauriti, submit) — nessuna modifica di comportamento, solo spostamento
  di codice. Unica semplificazione accettata: il testo placeholder
  "Verifica disponibilità in corso…" nelle *opzioni del menu a tendina* evento
  (non nei badge dello slider, che restano invariati) viene rimosso — micro
  dettaglio cosmetico dentro un `<select>` chiuso, non un requisito del progetto.
- Non toccare le card dello slider, gli hint di swipe, i pallini di
  navigazione, o la logica dei posti sulla pagina Eventi — restano
  pixel-identici. Solo la sezione form viene sostituita dal componente
  condiviso.
- Non toccare le schede Prenotazioni/Portfolio di Gestione, nessuna RPC, nessuna
  policy RLS: questa feature non richiede modifiche allo schema del database
  (usa solo colonne `eventi` già esistenti: `id`, `titolo`, `pubblicato`,
  insieme a tutte le altre già lette da `getPublishedEvents`).
- No nuovi file `*.spec.ts` (convenzione del progetto: zero test automatici
  oltre allo scaffold di default). Ogni task si verifica con `npm run build`
  (zero errori TypeScript) e, dove indicato, un controllo manuale nel browser.

---

### Task 1: Utility per slug, url e stato "passato" dell'evento

**Files:**
- Modify: `src/app/core/utils/event-format.util.ts`

**Interfaces:**
- Produces: `DEFAULT_SEATS`, `SITE_URL`, `buildEventoSlug(titolo, id)`,
  `buildEventoUrl(titolo, id)`, `parseEventoId(slugId)`,
  `isEventoPassato(data, oraFine)` — usati da Task 3 (`PrenotazioneForm`,
  solo `DEFAULT_SEATS` non serve lì), Task 4 (`Eventi`, `DEFAULT_SEATS`),
  Task 5 (`EventoDettaglio`/resolver, tutte), Task 7 (`Gestione`,
  `buildEventoUrl`).

- [ ] **Step 1: Aggiungi le nuove utility in fondo al file**

Aggiungi in coda a `src/app/core/utils/event-format.util.ts` (dopo
`buildMapsUrl`, senza toccare le funzioni esistenti):

```ts
/** Numero di posti assunto per un evento finché il conteggio reale non è
 *  ancora arrivato dal database. */
export const DEFAULT_SEATS = 10;

/** Dominio di produzione del sito, usato per costruire URL assoluti (link
 *  condivisibili, tag Open Graph). */
export const SITE_URL = 'https://blooming-wild-art.vercel.app';

/** Es. "Workshop all'Aperto - Firenze!" -> "workshop-all-aperto-firenze". */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Genera lo slug leggibile usato nell'URL condivisibile di un evento (es. per
 *  Instagram). L'id in coda è l'unica parte che conta per il lookup (vedi
 *  parseEventoId): la parte testuale resta valida anche se il titolo
 *  dell'evento cambia dopo che il link è già stato condiviso. */
export function buildEventoSlug(titolo: string, id: number): string {
  const slug = slugify(titolo);
  return slug ? `${slug}-${id}` : `${id}`;
}

/** URL assoluto della pagina dedicata di un evento. */
export function buildEventoUrl(titolo: string, id: number): string {
  return `${SITE_URL}/eventi/${buildEventoSlug(titolo, id)}`;
}

/** Estrae l'id numerico dalla parte finale di uno slug (es.
 *  "workshop-firenze-42" -> 42). Ritorna null se non c'è nessun numero, cioè
 *  il link non è valido. */
export function parseEventoId(slugId: string): number | null {
  const match = slugId.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Un evento è "passato" quando la sua fascia oraria (data + ora di fine) è
 *  già trascorsa. */
export function isEventoPassato(data: string, oraFine: string): boolean {
  return new Date(`${data}T${oraFine}`).getTime() < Date.now();
}
```

- [ ] **Step 2: Verifica il build**

Run: `npm run build`
Expected: nessun errore TypeScript (le nuove funzioni non sono ancora usate da
nessuna parte, quindi non cambia nient'altro).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/utils/event-format.util.ts
git commit -m "feat(eventi): aggiunge utility per slug/url condivisibile e stato evento passato"
```

---

### Task 2: `SupabaseService.getEventoById`

**Files:**
- Modify: `src/app/core/services/supabase.service.ts`

**Interfaces:**
- Produces: `getEventoById(id: number): Promise<PaintEvent | null>` — usato dal
  resolver di Task 5.

- [ ] **Step 1: Aggiungi il metodo**

Aggiungi in `src/app/core/services/supabase.service.ts`, subito dopo
`getPublishedEvents()` (stesso stile di mapping riga-oggetto):

```ts
  /** Un singolo evento pubblicato per id, o null se non esiste/non è pubblicato. */
  async getEventoById(id: number): Promise<PaintEvent | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('eventi')
      .select('*')
      .eq('id', id)
      .eq('pubblicato', true)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data['id'],
      title: data['titolo'],
      descrizione: data['descrizione'],
      data: data['data'],
      oraInizio: data['ora_inizio'],
      oraFine: data['ora_fine'],
      luogo: data['luogo'],
      indirizzo: data['indirizzo'],
      prezzo: data['prezzo'],
      locandinaUrl: data['locandina_url'],
    };
  }
```

- [ ] **Step 2: Verifica il build**

Run: `npm run build`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/supabase.service.ts
git commit -m "feat(eventi): aggiunge SupabaseService.getEventoById per il lookup singolo evento"
```

---

### Task 3: Componente condiviso `PrenotazioneForm`

**Files:**
- Create: `src/app/shared/prenotazione-form/prenotazione-form.ts`
- Create: `src/app/shared/prenotazione-form/prenotazione-form.html`

**Interfaces:**
- Consumes: `SupabaseService.prenotaPosto` (esistente, invariato),
  `PaintEventWithSeats` (esistente, da `core/models/event.model.ts`).
- Produces: componente standalone `app-prenotazione-form` con:
  - `@Input({ required: true }) events: PaintEventWithSeats[]`
  - `@Input() showEventSelector = true`
  - `@Input() preselectedEventId: number | null` (setter — ogni nuovo valore
    seleziona quell'evento nel form e resetta stato di successo/errore)
  - `@Output() bookingCompleted: EventEmitter<void>` (emesso dopo una
    prenotazione riuscita o dopo un tentativo fallito per posti esauriti nel
    frattempo — in entrambi i casi il genitore deve ricaricare i posti)

  Usato da Task 4 (`Eventi`) e Task 5 (`EventoDettaglio`).

- [ ] **Step 1: Crea `prenotazione-form.ts`**

```ts
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
import { SupabaseService, BookingSubmission } from '../../core/services/supabase.service';
import { PaintEventWithSeats } from '../../core/models/event.model';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-prenotazione-form',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, Icon],
  templateUrl: './prenotazione-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrenotazioneForm {
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

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
      this.errorMessage.set('Controlla i campi evidenziati in rosso: alcuni dati mancano o non sono validi.');
      return;
    }

    const eventId = this.form.controls.eventId.value!;
    const matchingEvent = this.selectedEvent();
    const currentSeats = matchingEvent?.seatsAvailable ?? 0;
    const numeroPosti = Math.round(this.form.controls.numeroPosti.value);

    if (currentSeats < numeroPosti) {
      const postiParola = currentSeats === 1 ? 'posto disponibile' : 'posti disponibili';
      this.errorMessage.set(
        `Solo ${currentSeats} ${postiParola} per questo evento: riduci il numero di partecipanti o scegli un'altra data.`,
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
      this.errorMessage.set('Si è verificato un problema con la registrazione. Riprova.');
      this.submitting.set(false);
      return;
    }
    if (!success) {
      this.errorMessage.set('Ops! I posti per questo evento si sono esauriti un istante fa.');
      this.submitting.set(false);
      this.bookingCompleted.emit();
      return;
    }

    this.submitting.set(false);
    this.bookingSuccess.set(true);
    this.bookingCompleted.emit();
    this.form.reset({ billingType: 'privato', numeroPosti: 1 });
  }
}
```

- [ ] **Step 2: Crea `prenotazione-form.html`**

```html
<div class="max-w-2xl w-full bg-white rounded shadow-lg p-6 md:p-10 z-10 border border-gray-200 mx-auto">
  <div class="flex flex-col items-center mb-8 text-center">
    <h2 class="text-3xl md:text-5xl font-title font-medium text-gray-900 tracking-wide">Prenota il tuo posto</h2>
  </div>

  @if (!bookingSuccess()) {
    <div class="flex items-center justify-center gap-2 mb-8 text-[10px] md:text-xs font-semibold tracking-widest uppercase">
      <span class="flex items-center gap-1.5" [class.text-brand]="step1Complete()" [class.text-gray-400]="!step1Complete()">
        <span
          class="w-5 h-5 rounded-full border flex items-center justify-center"
          [class.bg-brand]="step1Complete()"
          [class.border-brand]="step1Complete()"
          [class.text-white]="step1Complete()"
          [class.border-gray-300]="!step1Complete()"
        >1</span>
        Dati
      </span>
      <span class="w-6 h-px bg-gray-200"></span>
      <span class="flex items-center gap-1.5" [class.text-brand]="step2Complete()" [class.text-gray-400]="!step2Complete()">
        <span
          class="w-5 h-5 rounded-full border flex items-center justify-center"
          [class.bg-brand]="step2Complete()"
          [class.border-brand]="step2Complete()"
          [class.text-white]="step2Complete()"
          [class.border-gray-300]="!step2Complete()"
        >2</span>
        Fatturazione
      </span>
    </div>

    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6 text-left text-sm">
      <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2">1. Dati Partecipante</p>

      @if (showEventSelector) {
        <div>
          <label for="event-select" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Seleziona l'evento *</label>
          <select id="event-select" formControlName="eventId" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-brand focus:outline-none font-medium text-gray-800 transition-colors">
            <option [ngValue]="null" disabled>Seleziona un appuntamento...</option>
            @for (ev of events; track ev.id) {
              <option [ngValue]="ev.id" [disabled]="ev.isSoldOut">
                {{ ev.title }} ({{ ev.dateLabel }}) - {{ ev.isSoldOut ? 'SOLD OUT' : 'Posti: ' + ev.seatsAvailable }}
              </option>
            }
          </select>
          @if (selectedEvent(); as ev) {
            <p class="text-xs md:text-base text-gray-600 mt-2 leading-relaxed">{{ ev.descrizione }}</p>
          }
        </div>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="user-name" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Nome e Cognome *</label>
          <input type="text" id="user-name" formControlName="name" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Emanuela Viola">
        </div>
        <div>
          <label for="user-email" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Email *</label>
          <input type="email" id="user-email" formControlName="email" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="esempio@email.com">
        </div>
      </div>

      <div>
        <label for="user-numero-posti" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Numero di Partecipanti *</label>
        <input type="number" id="user-numero-posti" formControlName="numeroPosti" min="1" step="1" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
        @if (selectedEvent(); as ev) {
          <p class="text-xs text-gray-600 mt-2">Posti disponibili per questo evento: {{ ev.seatsAvailable }} · € {{ ev.prezzo | number: '1.2-2' }} a persona</p>
        }
      </div>

      <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2 pt-4">2. Fatturazione</p>
      <div>
        <label for="billing-type" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Tipologia Account *</label>
        <select id="billing-type" formControlName="billingType" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-brand focus:outline-none font-medium text-gray-800">
          <option value="privato">Privato (Ricevuta con Codice Fiscale)</option>
          <option value="business">Azienda / Libero Professionista (Fattura con P.IVA)</option>
        </select>
      </div>

      @if (isPrivato()) {
        <div>
          <label for="user-cf" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Codice Fiscale *</label>
          <input type="text" id="user-cf" formControlName="cf" maxlength="16" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800 uppercase" placeholder="FMTLNZ90A01F205X">
        </div>
      } @else {
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="company-name" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Ragione Sociale *</label>
              <input type="text" id="company-name" formControlName="companyName" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Studio d'Arte S.r.l.">
            </div>
            <div>
              <label for="company-piva" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Partita IVA *</label>
              <input type="text" id="company-piva" formControlName="companyPiva" maxlength="11" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="11 cifre numeriche">
            </div>
          </div>
          <div>
            <label for="company-sdi" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Codice Destinatario SDI *</label>
            <input type="text" id="company-sdi" formControlName="companySdi" maxlength="7" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800 uppercase" placeholder="M5UXCR1">
          </div>
        </div>
      }

      <div>
        <label for="billing-address" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Via e Numero Civico *</label>
        <input type="text" id="billing-address" formControlName="address" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Corso Umberto I, 45">
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label for="billing-cap" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">CAP *</label>
          <input type="text" id="billing-cap" formControlName="cap" maxlength="5" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="74121">
        </div>
        <div class="sm:col-span-2">
          <label for="billing-city" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Città e Provincia *</label>
          <input type="text" id="billing-city" formControlName="city" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Taranto (TA)">
        </div>
      </div>

      @if (errorMessage(); as err) {
        <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
      }

      <div class="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          id="privacy-accepted"
          formControlName="privacyAccepted"
          class="mt-0.5 accent-brand"
        />
        <label for="privacy-accepted">
          Ho letto e compreso l'<button type="button" (click)="openPrivacyNotice()" class="text-brand underline hover:text-brand-hover">informativa sulla privacy</button> *
        </label>
      </div>

      <div class="text-center pt-6">
        <button type="submit" [disabled]="submitting()" class="w-full md:w-auto bg-action text-white font-medium text-sm tracking-widest py-4 px-10 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
          {{ submitting() ? 'Invio in corso...' : 'Invia Iscrizione' }}
        </button>
      </div>
    </form>
  } @else {
    <div class="mt-6 bg-action text-white text-center p-5 rounded border border-action-hover shadow-lg font-title italic text-lg flex items-center justify-center gap-2">
      <app-icon name="sparkles" [size]="20" />
      <span>Iscrizione salvata! Il tuo posto è riservato: Silvia ti contatterà via email per la conferma.</span>
    </div>
  }

  <div #privacyNotice class="mt-8 pt-6 border-t border-gray-200">
    <button
      type="button"
      (click)="togglePrivacyNotice()"
      [attr.aria-expanded]="showPrivacyNotice()"
      class="flex items-center justify-between w-full text-left text-xs font-bold text-gray-600 uppercase tracking-widest"
    >
      Informativa sulla privacy
      <app-icon name="chevron-down" [size]="16" class="transition-transform" [class.rotate-180]="showPrivacyNotice()" />
    </button>

    @if (showPrivacyNotice()) {
      <div class="mt-4 space-y-3 text-xs text-gray-600 leading-relaxed">
        <p>1. <strong>Titolare del trattamento</strong>: Silvia Sgaramella, P.IVA 03483350736 — contatto per richieste privacy: silvia.sgara&#64;gmail.com</p>
        <p>2. <strong>Dati raccolti</strong>: nome e cognome, email, codice fiscale (per i privati) oppure ragione sociale/partita IVA/codice SDI (per aziende/professionisti), indirizzo, CAP, città.</p>
        <p>3. <strong>Finalità e base giuridica</strong>: i dati sono raccolti per gestire la prenotazione al workshop ed emettere la relativa fattura o ricevuta fiscale — base giuridica: esecuzione del contratto (art. 6.1.b GDPR) e adempimento di obblighi di legge fiscale (art. 6.1.c GDPR).</p>
        <p>4. <strong>Dove sono conservati i dati</strong>: i dati sono ospitati su Supabase (fornitore di database/hosting), che agisce come responsabile del trattamento per conto del titolare.</p>
        <p>5. <strong>Font esterni</strong>: il sito carica i caratteri tipografici direttamente dai server di Google Fonts; il browser si collega a Google, che riceve l'indirizzo IP di chi visita il sito.</p>
        <p>6. <strong>Periodo di conservazione</strong>: i dati relativi a prenotazioni fatturate sono conservati per il periodo previsto dalla normativa fiscale italiana per la documentazione contabile (indicativamente 10 anni, salvo diversa indicazione del proprio commercialista).</p>
        <p>7. <strong>Diritti dell'interessato</strong>: accesso, rettifica, cancellazione, limitazione, opposizione al trattamento e portabilità dei dati, scrivendo a silvia.sgara&#64;gmail.com; è possibile inoltre presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
        <p>8. <strong>Cookie</strong>: il sito non utilizza cookie di profilazione o tracciamento a fini pubblicitari.</p>
      </div>
    }
  </div>
</div>
```

- [ ] **Step 3: Verifica il build**

Run: `npm run build`
Expected: nessun errore (il componente non è ancora usato da nessuna parte, ma
deve compilare in isolamento).

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/prenotazione-form/
git commit -m "feat(eventi): estrae il form di prenotazione in un componente condiviso PrenotazioneForm"
```

---

### Task 4: `Eventi` usa `PrenotazioneForm`

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:**
- Consumes: `app-prenotazione-form` (Task 3), `DEFAULT_SEATS` (Task 1).

- [ ] **Step 1: Sostituisci `eventi.ts`**

Sostituisci l'intero contenuto di `src/app/features/eventi/eventi.ts` con:

```ts
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
```

Nota: `ReactiveFormsModule`, `FormBuilder`, `Validators`, `takeUntilDestroyed`,
`toSignal` non servono più qui (tutta la logica del form è in
`PrenotazioneForm`) — non importarli.

- [ ] **Step 2: Sostituisci la sezione form in `eventi.html`**

In `src/app/features/eventi/eventi.html`, il blocco che va dalla riga con
`<!-- SEZIONE PRENOTAZIONE / FORM -->` fino alla `}` finale del file (righe
146-319 circa) va sostituito. Trova questo blocco:

```html
<!-- SEZIONE PRENOTAZIONE / FORM -->
<section #bookingSection class="bg-parchment pb-10 px-4 relative flex flex-col items-center justify-center scroll-mt-20">
  <div class="max-w-2xl w-full bg-white rounded shadow-lg p-6 md:p-10 z-10 border border-gray-200">
```

...(tutto il contenuto del form, i due step, il messaggio di successo,
l'informativa privacy)...

```html
  </div>
</section>
}
```

E sostituiscilo con:

```html
<!-- SEZIONE PRENOTAZIONE / FORM -->
<section #bookingSection class="bg-parchment pb-10 px-4 relative flex flex-col items-center justify-center scroll-mt-20">
  <app-prenotazione-form
    [events]="eventsWithSeats()"
    [preselectedEventId]="preselectedEventId()"
    (bookingCompleted)="onBookingCompleted()"
  />
</section>
}
```

Il resto del file (slider, card, separatore sopra questa sezione) resta
identico — non toccarlo.

- [ ] **Step 3: Verifica il build**

Run: `npm run build`
Expected: nessun errore.

- [ ] **Step 4: Verifica manuale**

Con `ng serve` in locale: apri `/eventi`, clicca "Prenotati" su una card,
verifica che il form appaia con l'evento giusto preselezionato, che i due step
si aggiornino compilando i campi, e che passando a un'altra card il form si
aggiorni sull'evento nuovo. Non serve completare una prenotazione reale in
questo task (verificato end-to-end nel task successivo).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html
git commit -m "refactor(eventi): usa il componente condiviso PrenotazioneForm"
```

---

### Task 5: `EventoDettaglio` + resolver

**Files:**
- Create: `src/app/features/evento-dettaglio/evento-dettaglio.resolver.ts`
- Create: `src/app/features/evento-dettaglio/evento-dettaglio.ts`
- Create: `src/app/features/evento-dettaglio/evento-dettaglio.html`

**Interfaces:**
- Consumes: `SupabaseService.getEventoById`/`getEventSeats` (Task 2 + esistente),
  `parseEventoId`/`buildEventoUrl`/`isEventoPassato`/`DEFAULT_SEATS`/`SITE_URL`
  (Task 1), `app-prenotazione-form` (Task 3).
- Produces: `eventoResolver` (`ResolveFn<PaintEventWithSeats>`, popola
  `route.data['event']`) e componente `app-evento-dettaglio` — entrambi
  registrati nella route da Task 6.

- [ ] **Step 1: Crea il resolver**

```ts
import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { PaintEventWithSeats } from '../../core/models/event.model';
import {
  formatDataItaliana,
  formatFasciaOraria,
  buildMapsUrl,
  parseEventoId,
  DEFAULT_SEATS,
} from '../../core/utils/event-format.util';

export const eventoResolver: ResolveFn<PaintEventWithSeats> = async (route) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const notFound = () => new RedirectCommand(router.parseUrl('/eventi'));

  const id = parseEventoId(route.paramMap.get('slugId') ?? '');
  if (id === null) return notFound();

  const [ev, seatMap] = await Promise.all([supabase.getEventoById(id), supabase.getEventSeats()]);
  if (!ev) return notFound();

  const seatsAvailable = seatMap[ev.id] ?? DEFAULT_SEATS;
  return {
    ...ev,
    seatsAvailable,
    isSoldOut: seatsAvailable <= 0,
    dateLabel: formatDataItaliana(ev.data),
    timeLabel: formatFasciaOraria(ev.oraInizio, ev.oraFine),
    mapsUrl: buildMapsUrl(ev.luogo, ev.indirizzo),
  };
};
```

- [ ] **Step 2: Crea `evento-dettaglio.ts`**

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { SupabaseService } from '../../core/services/supabase.service';
import { PaintEventWithSeats } from '../../core/models/event.model';
import { buildEventoUrl, isEventoPassato, DEFAULT_SEATS, SITE_URL } from '../../core/utils/event-format.util';
import { Icon } from '../../shared/icon/icon';
import { PrenotazioneForm } from '../../shared/prenotazione-form/prenotazione-form';

@Component({
  selector: 'app-evento-dettaglio',
  standalone: true,
  imports: [DecimalPipe, RouterLink, Icon, PrenotazioneForm],
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
```

- [ ] **Step 3: Crea `evento-dettaglio.html`**

```html
<section class="relative w-full h-[70vh] md:h-[85vh] min-h-[480px] overflow-hidden">
  @if (event().locandinaUrl) {
    <img [src]="event().locandinaUrl" [alt]="event().title" class="absolute inset-0 w-full h-full object-cover" />
  } @else {
    <div class="absolute inset-0 bg-gradient-to-br from-action via-bark to-brand"></div>
    <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 28px 28px;"></div>
  }

  <div class="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent"></div>

  <div class="absolute inset-x-0 bottom-0 p-6 md:p-10 text-white max-w-4xl mx-auto">
    <div class="flex flex-wrap items-center gap-2 md:gap-3 mb-3 md:mb-4">
      @if (isPast) {
        <p class="inline-flex w-fit items-center gap-1.5 md:gap-2 text-xs md:text-base font-title italic px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-md bg-white text-gray-900">
          Evento concluso
        </p>
      } @else if (event().isSoldOut) {
        <p class="inline-flex w-fit items-center gap-1.5 md:gap-2 text-xs md:text-base font-title italic px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-md bg-red-500 text-white">
          <app-icon name="alert-triangle" [size]="16" /> Attenzione: Posti esauriti per questa data
        </p>
      } @else {
        <p class="inline-flex w-fit items-center gap-1.5 md:gap-2 text-xs md:text-base font-title italic px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-md bg-white text-gray-900">
          <app-icon name="sparkles" [size]="16" /> Solo {{ event().seatsAvailable }} posti ancora disponibili
        </p>
      }
      <span class="bg-white text-gray-900 font-title italic text-xs md:text-base px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-md">
        € {{ event().prezzo | number: '1.2-2' }}
      </span>
    </div>

    <h1 class="text-2xl md:text-5xl font-title font-medium mb-1 md:mb-2 tracking-wide">{{ event().title }}</h1>

    <p class="flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1 text-xs md:text-lg opacity-90">
      <span class="flex items-center gap-1.5 md:gap-2"><app-icon name="calendar" [size]="15" /> {{ event().dateLabel }} · {{ event().timeLabel }}</span>
      <span class="flex items-center gap-1.5 md:gap-2"><app-icon name="map-pin" [size]="15" /> {{ event().luogo }}, {{ event().indirizzo }}</span>
    </p>
  </div>
</section>

<section class="bg-parchment py-10 px-4">
  <div class="max-w-2xl mx-auto mb-10 text-center">
    <p class="text-gray-700 text-sm md:text-base leading-relaxed text-left">{{ event().descrizione }}</p>
    <a
      [href]="event().mapsUrl"
      target="_blank"
      class="inline-flex items-center gap-1.5 md:gap-2 border border-gray-300 text-gray-700 text-xs md:text-base font-semibold tracking-widest px-4 py-3 md:px-6 md:py-4 rounded hover:border-brand hover:text-brand transition-colors uppercase mt-6"
    ><app-icon name="map" [size]="14" /> Apri mappa</a>
  </div>

  @if (isPast) {
    <div class="max-w-2xl mx-auto bg-white rounded shadow-lg border border-gray-200 p-8 text-center">
      <p class="text-gray-600 text-sm md:text-base">Questo evento si è già svolto. Segui la pagina <a routerLink="/eventi" class="text-brand underline hover:text-brand-hover">Eventi</a> per scoprire i prossimi appuntamenti.</p>
    </div>
  } @else {
    <app-prenotazione-form
      [events]="[event()]"
      [preselectedEventId]="event().id"
      [showEventSelector]="false"
      (bookingCompleted)="onBookingCompleted()"
    />
  }
</section>
```

- [ ] **Step 4: Verifica il build**

Run: `npm run build`
Expected: nessun errore (la route non è ancora collegata — verrà cablata nel
prossimo task — ma i file devono compilare in isolamento).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/evento-dettaglio/
git commit -m "feat(eventi): aggiunge il componente EventoDettaglio e il relativo resolver"
```

---

### Task 6: Collega la route

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.routes.server.ts`

**Interfaces:**
- Consumes: `EventoDettaglio`, `eventoResolver` (Task 5).

- [ ] **Step 1: Aggiungi la route in `app.routes.ts`**

In `src/app/app.routes.ts`, aggiungi l'import in cima al file:

```ts
import { eventoResolver } from './features/evento-dettaglio/evento-dettaglio.resolver';
```

E aggiungi questa route subito dopo quella di `eventi` (prima di `shop`):

```ts
  {
    path: 'eventi/:slugId',
    loadComponent: () => import('./features/evento-dettaglio/evento-dettaglio').then((m) => m.EventoDettaglio),
    resolve: { event: eventoResolver },
  },
```

- [ ] **Step 2: Aggiungi la modalità di rendering in `app.routes.server.ts`**

In `src/app/app.routes.server.ts`, aggiungi questa voce prima di `'**'`:

```ts
  {
    path: 'eventi/:slugId',
    renderMode: RenderMode.Server
  },
```

Il file completo diventa:

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'gestione-prenotazioni',
    renderMode: RenderMode.Client
  },
  {
    path: 'eventi/:slugId',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
```

- [ ] **Step 3: Verifica il build**

Run: `npm run build`
Expected: nessun errore; nel log di build compare `eventi/:slugId` come route
a rendering server (non tra le route prerenderizzate).

- [ ] **Step 4: Verifica manuale end-to-end**

Con `ng serve` in locale (o `npm run build && node dist/silvia-app/server/server.mjs`
per un test più fedele al comportamento server):
- apri `/eventi/qualsiasi-cosa-9999` (id inesistente) → deve reindirizzare a `/eventi`;
- apri `/eventi/qualsiasi-cosa` (nessun numero) → deve reindirizzare a `/eventi`;
- prendi un id reale di un evento pubblicato dal database e apri
  `/eventi/prova-{id}` → deve mostrare la pagina dedicata con locandina, titolo,
  data, luogo, prezzo, descrizione corretti;
- completa una prenotazione di prova direttamente da questa pagina e verifica
  che vada a buon fine (stesso comportamento della pagina Eventi);
- ispeziona l'HTML restituito dal server per quella pagina (view-source, o
  `curl` sull'URL) e verifica che `<title>` e i meta tag `og:title`/`og:image`/
  `og:description` contengano già i dati reali dell'evento (non il testo
  generico di `index.html`) — questo conferma che l'anteprima Instagram
  funzionerà.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/app.routes.server.ts
git commit -m "feat(eventi): collega la route /eventi/:slugId con rendering lato server"
```

---

### Task 7: Bottone "Copia link" in Gestione

**Files:**
- Modify: `src/app/features/gestione/gestione.ts`
- Modify: `src/app/features/gestione/gestione.html`

**Interfaces:**
- Consumes: `buildEventoUrl` (Task 1).

- [ ] **Step 1: Aggiungi lo stato e il metodo in `gestione.ts`**

Aggiungi l'import in cima al file (nella riga esistente che importa da
`event-format.util`, o come nuova riga se separata):

```ts
import { formatFasciaOraria, buildEventoUrl } from '../../core/utils/event-format.util';
```

Aggiungi, vicino alle altre proprietà della sezione Eventi (es. dopo
`eventActionError`):

```ts
  protected readonly linkCopiedId = signal<number | null>(null);
```

Aggiungi questo metodo (es. vicino a `toggleEventoPubblicato`):

```ts
  async copyEventoLink(ev: PaintEventAdmin): Promise<void> {
    const url = buildEventoUrl(ev.title, ev.id);
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopiedId.set(ev.id);
      setTimeout(() => this.linkCopiedId.update((id) => (id === ev.id ? null : id)), 2000);
    } catch {
      this.eventActionError.set('Impossibile copiare il link. Riprova.');
    }
  }
```

- [ ] **Step 2: Aggiungi il bottone in `gestione.html`**

Trova, nella scheda Eventi, il blocco dei bottoni per riga evento:

```html
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" (click)="openEditEventForm(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">Modifica</button>
              <button type="button" (click)="toggleEventoPubblicato(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">
                {{ ev.pubblicato ? 'Nascondi' : 'Pubblica' }}
              </button>
            </div>
```

E sostituiscilo con:

```html
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" (click)="copyEventoLink(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">
                {{ linkCopiedId() === ev.id ? 'Copiato!' : 'Copia link' }}
              </button>
              <button type="button" (click)="openEditEventForm(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">Modifica</button>
              <button type="button" (click)="toggleEventoPubblicato(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">
                {{ ev.pubblicato ? 'Nascondi' : 'Pubblica' }}
              </button>
            </div>
```

- [ ] **Step 3: Verifica il build**

Run: `npm run build`
Expected: nessun errore.

- [ ] **Step 4: Verifica manuale**

Login nel pannello Gestione, scheda Eventi: clicca "Copia link" su un evento,
il testo del bottone deve diventare "Copiato!" per ~2 secondi e l'URL negli
appunti deve corrispondere al formato `https://blooming-wild-art.vercel.app/eventi/{slug}-{id}`
e aprirsi correttamente in una nuova scheda.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/gestione/gestione.ts src/app/features/gestione/gestione.html
git commit -m "feat(gestione): bottone Copia link per condividere l'evento su Instagram"
```
