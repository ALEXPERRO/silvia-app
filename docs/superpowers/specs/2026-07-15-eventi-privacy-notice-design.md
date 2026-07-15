# Eventi booking form — GDPR privacy notice (informativa)

## Context

Following the RLS lockdown that closed public read access to the `prenotazioni` table (see the security fix committed 2026-07-14), the user asked whether the data collected on the booking form (name, email, codice fiscale/partita IVA, address) can legally be stored for invoicing purposes, and to check GDPR rules. The data collection itself is legitimate — it's exactly what Italian tax law requires to issue a valid invoice, and the legal basis is solid (contract performance + legal/fiscal obligation). What was missing: the site has no privacy notice (informativa) anywhere, which Art. 13 GDPR requires at the point of data collection.

This spec covers adding that notice to the Eventi page, plus a mandatory acknowledgment checkbox on the booking form. It does **not** cover the admin login/booking-cancellation feature or the PayPal button discussed in the same conversation — those are separate, later phases.

**Caveat carried over from the brainstorm and worth restating in the spec:** this content is drafted with reasonable, informed placeholders — not verified legal advice. The retention period and the exact controller identity should be confirmed with Silvia's commercialista before the placeholders are filled in with real values.

## What stays the same (out of scope)

- No dedicated `/privacy` route — the notice lives only as a section on the Eventi page, per explicit user choice.
- No footer link, no mention on Home/Portfolio/Shop.
- The newsletter signup form (Footer) does not get a consent checkbox in this pass — it's a separate, currently non-functional feature (the `iscrizioni_newsletter` table doesn't exist yet in Supabase, a pre-existing gap unrelated to this work).
- No cookie-consent banner — the site doesn't use tracking/profiling cookies, so the notice states this rather than adding a banner.
- `content.service.ts`, routing, and every other page — untouched.

## Design

### 1. Placement and interaction

A new collapsible (accordion) section at the bottom of `eventi.html`, below the existing booking-confirmation section (inside the `@if (showBookingSection())` block's card, or as its own block right after it — placed so it's near the form that actually collects the data, matching the user's choice of "next to where data is collected" over a global footer link).

Collapsed by default, showing only a heading button; expanding reveals the full text. A `showPrivacyNotice` signal (boolean, default `false`) on the `Eventi` component toggles it — same pattern already used elsewhere in this component for other UI toggles (`showBookingSection`, `showSwipeHint`), no new abstraction needed.

### 2. Notice content

Exact copy (Italian), with bracketed placeholders Silvia fills in later — these are **not** code placeholders to leave TBD, they're literal text meant to ship as-is until she supplies the real values:

```
1. Titolare del trattamento: [RAGIONE SOCIALE / NOME], P.IVA [P.IVA] — contatto per richieste privacy: [EMAIL]
2. Dati raccolti: nome e cognome, email, codice fiscale (per i privati) oppure ragione sociale/partita IVA/codice SDI (per aziende/professionisti), indirizzo, CAP, città.
3. Finalità e base giuridica: i dati sono raccolti per gestire la prenotazione al workshop ed emettere la relativa fattura o ricevuta fiscale — base giuridica: esecuzione del contratto (art. 6.1.b GDPR) e adempimento di obblighi di legge fiscale (art. 6.1.c GDPR).
4. Dove sono conservati i dati: i dati sono ospitati su Supabase (fornitore di database/hosting), che agisce come responsabile del trattamento per conto del titolare.
5. Font esterni: il sito carica i caratteri tipografici direttamente dai server di Google Fonts; il browser si collega a Google, che riceve l'indirizzo IP di chi visita il sito.
6. Periodo di conservazione: i dati relativi a prenotazioni fatturate sono conservati per il periodo previsto dalla normativa fiscale italiana per la documentazione contabile (indicativamente 10 anni, salvo diversa indicazione del proprio commercialista).
7. Diritti dell'interessato: accesso, rettifica, cancellazione, limitazione, opposizione al trattamento e portabilità dei dati, scrivendo a [EMAIL]; è possibile inoltre presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).
8. Cookie: il sito non utilizza cookie di profilazione o tracciamento a fini pubblicitari.
```

Visual style: matches the site's existing card/legal-text conventions — `bg-white border border-gray-200 rounded` container consistent with other cards on this page (the booking form card, the event cards), body text at the smaller/muted size already used for fine print elsewhere (`text-xs text-gray-600`), numbered list styling kept simple (no new list component).

### 3. Mandatory checkbox on the booking form

A new required form control on the existing reactive form in `eventi.ts`:

```ts
protected readonly form = this.fb.nonNullable.group({
  // ...existing controls unchanged...
  privacyAccepted: [false, Validators.requiredTrue],
});
```

Rendered as a checkbox right above the submit button in `eventi.html`. The label reads "Ho letto e compreso l'informativa sulla privacy *", where "informativa sulla privacy" is itself a clickable trigger: clicking it sets `showPrivacyNotice` to `true` (opening the accordion if it's closed) and scrolls it into view, using the same `ElementRef` + `scrollIntoView` pattern already used for `bookingSectionRef` elsewhere in this component. The checkbox itself is a separate, normal `formControlName="privacyAccepted"` input — clicking the label text opens the notice, clicking the checkbox box toggles the value; these are two distinct click targets, not one combined control. The existing submit button's `[disabled]` binding and the `errorMessage` shown on invalid submit already handle the case where a required field is missing — `privacyAccepted` slots into that same existing validation path (`this.form.invalid` check in `onSubmit()`), no new error-handling branch needed.

### Accessibility & non-goals

- The accordion toggle button gets `[attr.aria-expanded]` bound to `showPrivacyNotice()`, matching how other toggle-driven UI in this codebase is expected to behave (keyboard-operable native `<button>`, not a `<div>` with a click handler).
- No email-sending, no server-side enforcement of the checkbox (it's client-side form validation only, consistent with the rest of this form) — a determined user could bypass client validation, same as any other required field on this form today; that's an accepted, pre-existing limitation of the whole form, not something this task introduces or fixes.

## Files touched

- `src/app/features/eventi/eventi.html` — new accordion section + checkbox in the form.
- `src/app/features/eventi/eventi.ts` — new `showPrivacyNotice` signal, new `privacyAccepted` form control.

No changes to `content.service.ts`, `supabase.service.ts`, routing, or any other component.
