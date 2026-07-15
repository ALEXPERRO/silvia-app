# Eventi Privacy Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible GDPR privacy notice to the Eventi booking section and a mandatory "I've read it" checkbox that blocks form submission until checked.

**Architecture:** Template + component-class change to the existing `Eventi` standalone component only — one new signal (`showPrivacyNotice`), one new form control (`privacyAccepted`), one new `ElementRef` + two new methods (open-and-scroll, toggle), following the exact same signal/`ViewChild`/`scrollIntoView` patterns already used in this file for `showBookingSection`/`bookingSectionRef`. No new components, no new services, no new routes.

**Tech Stack:** Angular 20 (standalone components, Reactive Forms, signals), Tailwind CSS v4.

## Global Constraints

- No dedicated `/privacy` route, no footer link — the notice lives only inside the Eventi booking section, per the approved spec.
- The newsletter signup form (Footer) is out of scope — no consent checkbox added there in this pass.
- No cookie-consent banner — the notice text itself states the site uses no tracking/profiling cookies.
- Business-identity placeholders (`[RAGIONE SOCIALE / NOME]`, `[P.IVA]`, `[EMAIL]`) are shipped literally as-is — they are real content for Silvia to fill in later, not TODOs to resolve in this task.
- Only `src/app/features/eventi/eventi.ts` and `src/app/features/eventi/eventi.html` change. No other file in the repo is touched.
- Verification method for this codebase: `npx ng build` (SSR + prerender must succeed) plus a manual visual/interaction check in a browser — this project has no unit/template test suite; build success + visual confirmation is the established acceptance check used throughout this repo's history.
- Placement resolution (the spec left this as an either/or — resolved here so there's no ambiguity for the implementer): the accordion notice goes **inside** the same white card as the booking form (`<div class="max-w-2xl w-full bg-white rounded shadow-lg p-6 md:p-10 z-10 border border-gray-200">` in `eventi.html`), placed **after** the `@if (!bookingSuccess()) { ... } @else { ... }` block closes and **before** that card's closing `</div>` — so it's visible in both the form state and the post-submission success state, always inside the same `@if (showBookingSection())` gate as everything else in that card.

---

### Task 1: Privacy notice accordion + mandatory checkbox

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:**
- Consumes: nothing from outside this component.
- Produces: nothing consumed elsewhere — this is a leaf, page-local feature. (For completeness: adds `protected showPrivacyNotice: WritableSignal<boolean>`, `protected openPrivacyNotice(): void`, `protected togglePrivacyNotice(): void`, and a new `privacyAccepted` boolean control on `this.form`, all private to this component's own template.)

- [ ] **Step 1: Confirm the current file matches this snapshot before editing**

Read `src/app/features/eventi/eventi.ts` lines 1-70 and confirm the form group still reads exactly:

```ts
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
```

And that lines 36-37 still read exactly:

```ts
  @ViewChild('sliderRef') private sliderRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bookingSection') private bookingSectionRef?: ElementRef<HTMLDivElement>;
```

If either has drifted, stop and reconcile before continuing — don't blindly overwrite.

- [ ] **Step 2: Add the `privacyAccepted` control to the form**

In `src/app/features/eventi/eventi.ts`, change:

```ts
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
```

to:

```ts
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
    privacyAccepted: [false, Validators.requiredTrue],
  });
```

No other form-related code needs to change: `onSubmit()`'s existing `if (this.form.invalid)` check already blocks submission when `privacyAccepted` is `false` (it reuses the same generic error message already shown for any other missing/invalid field — do not add a separate error branch for this field), and the existing `this.form.reset({ billingType: 'privato' })` call after a successful submission already resets `privacyAccepted` back to its initial value `false` for the next booking, since `reset()` restores every control not explicitly listed to its initial value.

- [ ] **Step 3: Add the `showPrivacyNotice` signal, the `privacyNoticeRef` ViewChild, and the two new methods**

In `src/app/features/eventi/eventi.ts`, change:

```ts
  @ViewChild('sliderRef') private sliderRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bookingSection') private bookingSectionRef?: ElementRef<HTMLDivElement>;
```

to:

```ts
  @ViewChild('sliderRef') private sliderRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bookingSection') private bookingSectionRef?: ElementRef<HTMLDivElement>;
  @ViewChild('privacyNotice') private privacyNoticeRef?: ElementRef<HTMLDivElement>;
```

Then find this existing signal declaration:

```ts
  protected readonly showBookingSection = signal(false);
```

and add a new signal declaration directly after it:

```ts
  protected readonly showBookingSection = signal(false);
  protected readonly showPrivacyNotice = signal(false);
```

Then find the existing `selectEventAndScroll` method:

```ts
  selectEventAndScroll(eventId: number): void {
    this.form.controls.eventId.setValue(eventId);
    this.bookingSuccess.set(false);
    this.errorMessage.set(null);
    this.showBookingSection.set(true);
    setTimeout(() => this.bookingSectionRef?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
  }
```

and add these two new methods directly after it (same class, same visibility level as the surrounding methods):

```ts
  selectEventAndScroll(eventId: number): void {
    this.form.controls.eventId.setValue(eventId);
    this.bookingSuccess.set(false);
    this.errorMessage.set(null);
    this.showBookingSection.set(true);
    setTimeout(() => this.bookingSectionRef?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
  }

  openPrivacyNotice(): void {
    this.showPrivacyNotice.set(true);
    setTimeout(() => this.privacyNoticeRef?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
  }

  togglePrivacyNotice(): void {
    this.showPrivacyNotice.update((v) => !v);
  }
```

- [ ] **Step 4: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.` (this step will fail until Step 5 below adds the matching template bindings — `formControlName="privacyAccepted"` doesn't need to exist yet for the TypeScript build to pass, since Angular template type-checking only fails on bindings that reference names that don't exist in the *component class*; the reverse — a class member with no template usage — is not an error. So this build should already pass right after Steps 2-3. If it doesn't, stop and read the actual compiler error before continuing to Step 5).

- [ ] **Step 5: Add the checkbox to the booking form**

In `src/app/features/eventi/eventi.html`, find:

```html
        @if (errorMessage(); as err) {
          <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
        }

        <div class="text-center pt-6">
          <button type="submit" [disabled]="submitting()" class="w-full md:w-auto bg-action text-white font-medium text-sm tracking-widest py-4 px-10 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
            {{ submitting() ? 'Invio in corso...' : 'Invia Iscrizione' }}
          </button>
        </div>
      </form>
```

and change it to:

```html
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
```

- [ ] **Step 6: Add the accordion notice inside the booking card**

In `src/app/features/eventi/eventi.html`, find:

```html
    } @else {
      <div class="mt-6 bg-action text-white text-center p-5 rounded border border-action-hover shadow-lg font-title italic text-lg flex items-center justify-center gap-2">
        <app-icon name="sparkles" [size]="20" />
        <span>Iscrizione salvata! Il tuo posto è riservato: Silvia ti contatterà via email per la conferma.</span>
      </div>
    }
  </div>
</section>
```

and change it to:

```html
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
          <p>1. <strong>Titolare del trattamento</strong>: [RAGIONE SOCIALE / NOME], P.IVA [P.IVA] — contatto per richieste privacy: [EMAIL]</p>
          <p>2. <strong>Dati raccolti</strong>: nome e cognome, email, codice fiscale (per i privati) oppure ragione sociale/partita IVA/codice SDI (per aziende/professionisti), indirizzo, CAP, città.</p>
          <p>3. <strong>Finalità e base giuridica</strong>: i dati sono raccolti per gestire la prenotazione al workshop ed emettere la relativa fattura o ricevuta fiscale — base giuridica: esecuzione del contratto (art. 6.1.b GDPR) e adempimento di obblighi di legge fiscale (art. 6.1.c GDPR).</p>
          <p>4. <strong>Dove sono conservati i dati</strong>: i dati sono ospitati su Supabase (fornitore di database/hosting), che agisce come responsabile del trattamento per conto del titolare.</p>
          <p>5. <strong>Font esterni</strong>: il sito carica i caratteri tipografici direttamente dai server di Google Fonts; il browser si collega a Google, che riceve l'indirizzo IP di chi visita il sito.</p>
          <p>6. <strong>Periodo di conservazione</strong>: i dati relativi a prenotazioni fatturate sono conservati per il periodo previsto dalla normativa fiscale italiana per la documentazione contabile (indicativamente 10 anni, salvo diversa indicazione del proprio commercialista).</p>
          <p>7. <strong>Diritti dell'interessato</strong>: accesso, rettifica, cancellazione, limitazione, opposizione al trattamento e portabilità dei dati, scrivendo a [EMAIL]; è possibile inoltre presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
          <p>8. <strong>Cookie</strong>: il sito non utilizza cookie di profilazione o tracciamento a fini pubblicitari.</p>
        </div>
      }
    </div>
  </div>
</section>
```

Note: `chevron-down` is already a valid `IconName` in `src/app/shared/icon/icon.ts` (used elsewhere in the codebase, e.g. `select`-adjacent UI) — no changes needed to the `Icon` component or its `IconName` union for this step.

- [ ] **Step 7: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.`, no errors about `formControlName="privacyAccepted"` or the new template references (`showPrivacyNotice`, `togglePrivacyNotice`, `openPrivacyNotice`) — if there's a compile error naming any of these, the class members from Steps 2-3 and the template from Steps 5-6 are out of sync; re-check spelling against this task's exact code before proceeding.

- [ ] **Step 8: Visual check in a browser**

Use the `run` skill (or `npm start` + a browser at `/eventi`) and walk through:
1. Click "Prenotati" on any non-sold-out event — the booking form appears as before.
2. Scroll to the bottom of the white booking card (below the submit button, or below the success message if you've already submitted once) — confirm a collapsed "Informativa sulla privacy" row is visible with a chevron icon.
3. Click that row — confirm it expands to show the 8-point numbered notice text (with the `[RAGIONE SOCIALE / NOME]`, `[P.IVA]`, `[EMAIL]` placeholders visible literally, exactly as specified — these are intentional, not a bug), and the chevron rotates. Click again — confirm it collapses.
4. Scroll back up to the form, leave the "Ho letto e compreso l'informativa sulla privacy" checkbox unchecked, fill in the rest of the form validly, and click "Invia Iscrizione" — confirm the same red "Controlla i campi evidenziati in rosso" message appears as for any other missing required field (no separate/different message), and the booking is not submitted.
5. Click the "informativa sulla privacy" link text inside that checkbox's label (not the header row from step 2) — confirm the page scrolls down and the notice auto-expands, even if it was collapsed.
6. Check the checkbox, submit again with all fields valid — confirm the booking succeeds as before (this exercises that `privacyAccepted` doesn't break the existing submit path).

- [ ] **Step 9: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html
git commit -m "$(cat <<'EOF'
feat(eventi): add GDPR privacy notice and mandatory acknowledgment checkbox

Collapsible informativa (Art. 13 GDPR) inside the booking card, covering
what's collected, why, where it's stored (Supabase), retention tied to
Italian fiscal record-keeping rules, and data-subject rights. The
booking form now requires an explicit "I've read it" checkbox before
submitting, reusing the form's existing invalid-field error path.

Business-identity placeholders ([RAGIONE SOCIALE / NOME], [P.IVA],
[EMAIL]) ship as literal text for Silvia to fill in.

See docs/superpowers/specs/2026-07-15-eventi-privacy-notice-design.md

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review notes

- **Spec coverage:** placement inside Eventi (✓ Steps 5-6), accordion collapsed-by-default behavior (✓ `showPrivacyNotice` defaults `false`), full 8-point notice text verbatim from the spec (✓ Step 6), mandatory checkbox blocking submit via existing `form.invalid` path (✓ Steps 2, 5), label-click opens-and-scrolls vs header-click toggles as two distinct targets (✓ `openPrivacyNotice` vs `togglePrivacyNotice`, Steps 3, 5, 6), `aria-expanded` on the toggle button (✓ Step 6), no other file touched (✓ only `eventi.ts`/`eventi.html` throughout).
- **No placeholders:** every step has literal code; the `[RAGIONE SOCIALE / NOME]` / `[P.IVA]` / `[EMAIL]` strings are the spec's own intentional shipped content, not a plan placeholder standing in for missing plan content.
- **Type/interface consistency:** `showPrivacyNotice`, `openPrivacyNotice`, `togglePrivacyNotice`, `privacyNoticeRef`, and the `privacyAccepted` control name are spelled identically everywhere they appear across Steps 2, 3, 5, and 6.
