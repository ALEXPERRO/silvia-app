# Traduzione inglese del sito — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un interruttore IT/EN che traduce all'istante tutti i testi fissi del sito (non i contenuti che Silvia inserisce da Supabase), usando `@ngx-translate/core`.

**Architecture:** Due file JSON (`src/assets/i18n/it.json`, `en.json`) importati direttamente nel bundle tramite un `TranslateLoader` sincrono (nessuna chiamata HTTP, compatibile col pre-rendering in build). Un `LanguageService` gestisce la persistenza in `localStorage` e inizializza `TranslateService`. Ogni componente usa il pipe `| translate` nel template; i messaggi costruiti dinamicamente in TypeScript (es. errori di validazione) usano `translateService.instant(...)`.

**Tech Stack:** Angular 20, `@ngx-translate/core` (ultima versione compatibile, verificare in Task 1), signal-based services già in uso nel progetto.

## Global Constraints

- Nessuna libreria di test automatico in questo progetto: ogni task si verifica con `npm run build` pulito + verifica manuale nel browser (stesso pattern di tutte le feature precedenti).
- I contenuti che arrivano da Supabase (titoli/descrizioni eventi, categorie e titoli portfolio) **non vanno mai tradotti**: restano sempre in italiano, qualunque sia la lingua selezionata.
- `/gestione-prenotazioni` non riceve l'interruttore lingua e resta interamente in italiano: nessuna chiave di traduzione va aggiunta ai suoi componenti.
- Le chiavi di traduzione sono in `UPPER_SNAKE_CASE`, annidate per pagina/componente (namespace in maiuscolo, es. `HOME.TAGLINE`), seguendo la convenzione standard di ngx-translate.
- Ogni task che tocca `it.json`/`en.json` aggiunge SOLO le proprie chiavi, senza toccare quelle già presenti da task precedenti (i file crescono in modo incrementale).
- Zero `console.log` di debug lasciati nel codice finale (pattern già visto rompere una build in questo progetto).

---

### Task 1: Installazione e infrastruttura ngx-translate

**Files:**
- Modify: `package.json` (aggiunge dipendenza)
- Create: `src/assets/i18n/it.json`
- Create: `src/assets/i18n/en.json`
- Create: `src/app/core/i18n/translate-loader.ts`
- Create: `src/app/core/i18n/language.service.ts`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Produces: `LanguageService` con `readonly currentLang: Signal<'it' | 'en'>` e metodo `setLanguage(lang: 'it' | 'en'): void` (imposta `TranslateService.use(lang)` e salva in `localStorage` sotto la chiave `'bw-lang'`). Tutti i task successivi iniettano questo servizio dove serve il toggle, e usano il pipe `translate` (fornito tramite l'import standalone `TranslatePipe`) ovunque serva testo tradotto.

- [ ] **Step 1: Installa la libreria**

```bash
npm install @ngx-translate/core
```

Dalla versione 18 in poi (requisito minimo Angular 18, questo progetto è su Angular 20: compatibile), l'API è a provider standalone (`provideTranslateService`) — la vecchia `TranslateModule.forRoot(...)` non esiste più in questa versione, non usarla.

- [ ] **Step 2: Crea i file di traduzione iniziali**

`src/assets/i18n/it.json`:
```json
{
  "NAV": {
    "ABOUT": "About me",
    "PORTFOLIO": "Portfolio",
    "EVENTI": "Eventi",
    "SHOP": "Shop"
  }
}
```

`src/assets/i18n/en.json`:
```json
{
  "NAV": {
    "ABOUT": "About me",
    "PORTFOLIO": "Portfolio",
    "EVENTI": "Events",
    "SHOP": "Shop"
  }
}
```

- [ ] **Step 3: Crea un loader sincrono (nessuna chiamata HTTP)**

`src/app/core/i18n/translate-loader.ts`:
```ts
import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import it from '../../../assets/i18n/it.json';
import en from '../../../assets/i18n/en.json';

const BUNDLES: Record<string, object> = { it, en };

/** Le traduzioni sono importate nel bundle in build, non scaricate via
 *  HTTP: evita ogni complicazione con HttpClient durante il pre-rendering
 *  (vedi supabase.service.ts per un problema analogo già risolto in questo
 *  progetto scegliendo import statici invece di chiamate di rete lato server). */
export class StaticTranslateLoader extends TranslateLoader {
  getTranslation(lang: string): Observable<object> {
    return of(BUNDLES[lang] ?? {});
  }
}
```
(`TranslateLoader` in `@ngx-translate/core` è una classe astratta, non un'interfaccia: usa `extends`, non `implements`.)

Verifica che `tsconfig.json`/`tsconfig.app.json` abbiano `"resolveJsonModule": true` (necessario per `import it from '...it.json'`); se manca, aggiungilo.

- [ ] **Step 4: Crea `LanguageService`**

`src/app/core/i18n/language.service.ts`:
```ts
import { Injectable, afterNextRender, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'it' | 'en';
const STORAGE_KEY = 'bw-lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly currentLang = signal<AppLang>('it');

  constructor() {
    this.translate.setDefaultLang('it');
    this.translate.use('it');

    afterNextRender(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'it' || stored === 'en') {
        this.setLanguage(stored);
      }
    });
  }

  setLanguage(lang: AppLang): void {
    this.currentLang.set(lang);
    this.translate.use(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }
}
```

- [ ] **Step 5: Configura i provider globali**

In `src/app/app.config.ts`, aggiungi (accanto ai provider già esistenti, senza rimuovere nulla):
```ts
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { StaticTranslateLoader } from './core/i18n/translate-loader';
```
e nell'array `providers`:
```ts
provideTranslateService({
  loader: provideTranslateLoader(StaticTranslateLoader),
  fallbackLang: 'it',
  lang: 'it',
}),
```
Importante: il loader va sempre passato tramite la funzione helper `provideTranslateLoader(...)`, non come oggetto `{ provide, useClass }` diretto — la libreria richiede questa forma per collegare correttamente il loader custom (documentato esplicitamente in ngx-translate.org/getting-started/installation).

- [ ] **Step 6: Verifica**

```bash
npm run build
```
Deve completare senza errori. Poi, in `src/app/layout/navbar/navbar.ts`, aggiungi temporaneamente `console.log(inject(LanguageService).currentLang())` nel costruttore solo per questa verifica manuale, avvia `npm start`, apri la console del browser e conferma che non ci siano errori di iniezione/provider. Rimuovi il log temporaneo prima di committare.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/assets/i18n src/app/core/i18n src/app/app.config.ts
git commit -m "feat(i18n): infrastruttura ngx-translate (loader sincrono + LanguageService)"
```

---

### Task 2: Componente toggle lingua + traduzione navbar/bottom-nav/footer

**Files:**
- Create: `src/app/shared/language-toggle/language-toggle.ts`
- Create: `src/app/shared/language-toggle/language-toggle.html`
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `FOOTER.*`)
- Modify: `src/app/layout/nav-items.ts`
- Modify: `src/app/layout/navbar/navbar.html`, `navbar.ts`
- Modify: `src/app/layout/bottom-nav/bottom-nav.html`, `bottom-nav.ts`
- Modify: `src/app/layout/footer/footer.html`, `footer.ts`

**Interfaces:**
- Consumes: `LanguageService` (Task 1) — `currentLang()`, `setLanguage(lang)`.
- Produces: `<app-language-toggle />` standalone component, usabile da qualunque layout component.

- [ ] **Step 1: Aggiorna le chiavi di navigazione condivise**

`src/app/layout/nav-items.ts` — sostituisci `label` con `labelKey`:
```ts
export interface NavItem {
  labelKey: string;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'NAV.ABOUT', path: '/' },
  { labelKey: 'NAV.PORTFOLIO', path: '/portfolio' },
  { labelKey: 'NAV.EVENTI', path: '/eventi' },
  { labelKey: 'NAV.SHOP', path: '/shop' },
];
```

Aggiorna `navbar.html` e `bottom-nav.html`: dove il template usa `{{ item.label }}`, sostituisci con `{{ item.labelKey | translate }}`. Aggiungi `TranslatePipe` (da `@ngx-translate/core`) all'array `imports` di `Navbar` e `BottomNav`.

- [ ] **Step 2: Crea il componente toggle**

`src/app/shared/language-toggle/language-toggle.ts`:
```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  templateUrl: './language-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  protected readonly i18n = inject(LanguageService);
}
```

`src/app/shared/language-toggle/language-toggle.html`:
```html
<div class="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest" role="group" aria-label="Lingua / Language">
  <button
    type="button"
    (click)="i18n.setLanguage('it')"
    [class.text-brand]="i18n.currentLang() === 'it'"
    [class.text-gray-400]="i18n.currentLang() !== 'it'"
    class="hover:text-brand transition-colors"
  >IT</button>
  <span class="text-gray-300">/</span>
  <button
    type="button"
    (click)="i18n.setLanguage('en')"
    [class.text-brand]="i18n.currentLang() === 'en'"
    [class.text-gray-400]="i18n.currentLang() !== 'en'"
    class="hover:text-brand transition-colors"
  >EN</button>
</div>
```

- [ ] **Step 3: Inserisci il toggle in navbar e footer**

In `navbar.html`, dentro il `<div class="max-w-5xl ... flex items-center justify-between gap-4">`, aggiungi `<app-language-toggle />` come terzo elemento (dopo il `<ul>` di navigazione), aggiungendo `LanguageToggle` a `imports` in `navbar.ts`.

In `footer.html`, aggiungi `<app-language-toggle />` in un blocco proprio (es. subito sopra la riga `{{ footer.credits }}`), aggiungendo `LanguageToggle` a `imports` in `footer.ts`.

- [ ] **Step 4: Traduci il footer**

Aggiungi a `it.json`/`en.json`:
```json
{
  "FOOTER": {
    "SUPPORT_CAPTION": "Se ti va di sostenere le mie attività",
    "COFFEE_BUTTON": "Offrimi un caffè",
    "EMAIL_ARIA": "Scrivi una email a Silvia"
  }
}
```
(EN corrispondente)
```json
{
  "FOOTER": {
    "SUPPORT_CAPTION": "If you'd like to support my work",
    "COFFEE_BUTTON": "Buy me a coffee",
    "EMAIL_ARIA": "Email Silvia"
  }
}
```

In `footer.html`, sostituisci:
- `Se ti va di sostenere le mie attività` → `{{ 'FOOTER.SUPPORT_CAPTION' | translate }}`
- `Offrimi un caffè` → `{{ 'FOOTER.COFFEE_BUTTON' | translate }}`
- `aria-label="Scrivi una email a Silvia"` → `[attr.aria-label]="'FOOTER.EMAIL_ARIA' | translate"`

Aggiungi `TranslatePipe` a `imports` in `footer.ts`.

- [ ] **Step 5: Verifica**

`npm run build` pulito. Poi `npm start`: conferma che il toggle compaia in navbar (desktop) e footer (mobile e desktop), che cliccando EN i 4 link di navigazione e i testi del footer cambino istantaneamente, che ricaricando la pagina la scelta resti EN (persistenza `localStorage`).

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/language-toggle src/app/layout src/assets/i18n
git commit -m "feat(i18n): interruttore lingua IT/EN in navbar e footer"
```

---

### Task 3: Traduzione Home (About me)

**Files:**
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `HOME.*`)
- Modify: `src/app/features/home/home.html`
- Modify: `src/app/features/home/home.ts` (aggiunge `TranslatePipe` a imports)

**Interfaces:**
- Consumes: pipe `translate` globale (Task 1).

- [ ] **Step 1: Aggiungi le chiavi**

`it.json` (dentro l'oggetto radice, accanto a `NAV`/`FOOTER` già presenti):
```json
{
  "HOME": {
    "TAGLINE": "Illustrazioni naturalistiche",
    "PULL_QUOTE": "Fin da bambina ho sempre guardato il mondo naturale con gli occhi della meraviglia, convinta che dietro ogni foglia si nascondesse una storia e dentro ogni tana un piccolo segreto.",
    "BIO_1": "Oggi uso i miei acquerelli per rivelare quel pizzico di magia che troppo spesso dimentichiamo di cercare.",
    "BIO_2": "Dipingo piante, fiori e animali creando composizioni animate da una delicata magia.",
    "BIO_3": "Quando non ho un pennello in mano, probabilmente mi troverai a passeggiare nella natura in cerca di ispirazione, o raggomitolata sul divano con una tazza fumante e un libro.",
    "BIO_4": "Se anche voi avete bisogno della vostra dose quotidiana di incanto siete nel posto giusto.",
    "PORTFOLIO_TITLE": "Dal Portfolio",
    "PORTFOLIO_INTRO": "Un assaggio del mio piccolo mondo ad acquerello.",
    "PORTFOLIO_CTA": "Scopri il portfolio",
    "WORKSHOP_TITLE": "Prossimo Workshop",
    "WORKSHOP_INTRO": "Vieni a dipingere con me: posti limitati, meraviglia garantita.",
    "WORKSHOP_CTA": "Scopri e prenota",
    "WORKSHOP_EMPTY_TITLE": "Il prossimo laboratorio si sta preparando",
    "WORKSHOP_EMPTY_TEXT": "Torna a trovarmi tra un po', il prossimo appuntamento non tarderà.",
    "SHOP_TITLE": "Porta la magia a casa tua",
    "SHOP_INTRO": "Stampe, sticker e segnalibri pensati per portare un pizzico di magia nella tua giornata.",
    "SHOP_EMPTY_TITLE": "Il negozio si sta preparando",
    "SHOP_EMPTY_TEXT": "Ci vediamo a Settembre, con le prime illustrazioni pronte da portare a casa."
  }
}
```

`en.json`:
```json
{
  "HOME": {
    "TAGLINE": "Nature illustrations",
    "PULL_QUOTE": "Ever since I was a child, I've looked at the natural world with wonder, convinced that every leaf hides a story and every burrow a small secret.",
    "BIO_1": "Today I use my watercolours to reveal that touch of magic we too often forget to look for.",
    "BIO_2": "I paint plants, flowers and animals, creating compositions alive with a delicate magic.",
    "BIO_3": "When I'm not holding a paintbrush, you'll probably find me wandering in nature looking for inspiration, or curled up on the sofa with a hot cup of tea and a book.",
    "BIO_4": "If you too need your daily dose of enchantment, you're in the right place.",
    "PORTFOLIO_TITLE": "From the Portfolio",
    "PORTFOLIO_INTRO": "A taste of my little watercolour world.",
    "PORTFOLIO_CTA": "Explore the portfolio",
    "WORKSHOP_TITLE": "Next Workshop",
    "WORKSHOP_INTRO": "Come paint with me: limited spots, guaranteed wonder.",
    "WORKSHOP_CTA": "Discover and book",
    "WORKSHOP_EMPTY_TITLE": "The next workshop is on its way",
    "WORKSHOP_EMPTY_TEXT": "Check back soon, the next date will be here before long.",
    "SHOP_TITLE": "Bring the magic home",
    "SHOP_INTRO": "Prints, stickers and bookmarks designed to bring a touch of magic to your day.",
    "SHOP_EMPTY_TITLE": "The shop is getting ready",
    "SHOP_EMPTY_TEXT": "See you in September, with the first illustrations ready to bring home."
  }
}
```

- [ ] **Step 2: Aggiorna il template**

In `home.html`, sostituisci ogni stringa fissa con il pipe corrispondente, per esempio:
- `Illustrazioni naturalistiche` → `{{ 'HOME.TAGLINE' | translate }}`
- il paragrafo pull-quote → `{{ 'HOME.PULL_QUOTE' | translate }}`
- i 4 `<p>` della bio → `{{ 'HOME.BIO_1' | translate }}` ... `{{ 'HOME.BIO_4' | translate }}`
- `Dal Portfolio` → `{{ 'HOME.PORTFOLIO_TITLE' | translate }}`, e così via per tutte le chiavi elencate sopra, mantenendo invariati i binding dinamici (`{{ ev.title }}`, `{{ ev.dateLabel }}`, ecc. — quelli restano dati reali, non si toccano).

Aggiungi `TranslatePipe` a `imports` in `home.ts`.

- [ ] **Step 3: Verifica**

`npm run build` pulito. `npm start`, vai sulla Home, passa da IT a EN col toggle: conferma che tutti i testi sopra elencati cambino, che la sezione "Prossimo Workshop" mostri correttamente sia il caso "evento trovato" (titolo/data/luogo restano in italiano, sono dati reali) sia il caso vuoto tradotto.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n src/app/features/home
git commit -m "feat(i18n): traduce la pagina About me"
```

---

### Task 4: Traduzione Portfolio

**Files:**
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `PORTFOLIO.*`)
- Modify: `src/app/features/portfolio/portfolio.html`
- Modify: `src/app/features/portfolio/portfolio.ts`

**Interfaces:**
- Consumes: pipe `translate` globale (Task 1).
- Nota: le etichette dei filtri categoria (`cat.label`, es. "Animali", "Composizioni") sono dati che arrivano da Supabase — **non tradurle**, resta solo `Tutte` (valore fisso hardcoded, non da Supabase) da tradurre.

- [ ] **Step 1: Aggiungi le chiavi**

`it.json`:
```json
{
  "PORTFOLIO": {
    "HERO_TITLE": "Portfolio",
    "HERO_DESCRIPTION": "Un viaggio visivo tra flora, fauna e atmosfere fiabesche. Esplora la mia raccolta di illustrazioni ad acquerello e lasciati trasportare nel mio piccolo mondo incantato.",
    "LOADING": "Caricamento galleria…",
    "EMPTY": "Nessuna illustrazione disponibile al momento.",
    "CATEGORY_ALL": "Tutte",
    "EMPTY_CATEGORY": "Nessuna illustrazione in questa categoria.",
    "PREV_PAGE_ARIA": "Pagina precedente",
    "NEXT_PAGE_ARIA": "Pagina successiva",
    "GO_TO_PAGE_ARIA": "Vai a pagina",
    "LIGHTBOX_CLOSE_ARIA": "Chiudi",
    "LIGHTBOX_PREV_ARIA": "Immagine precedente",
    "LIGHTBOX_NEXT_ARIA": "Immagine successiva"
  }
}
```

`en.json`:
```json
{
  "PORTFOLIO": {
    "HERO_TITLE": "Portfolio",
    "HERO_DESCRIPTION": "A visual journey through flora, fauna and fairy-tale atmospheres. Explore my collection of watercolour illustrations and let yourself be carried into my little enchanted world.",
    "LOADING": "Loading gallery…",
    "EMPTY": "No illustrations available at the moment.",
    "CATEGORY_ALL": "All",
    "EMPTY_CATEGORY": "No illustrations in this category.",
    "PREV_PAGE_ARIA": "Previous page",
    "NEXT_PAGE_ARIA": "Next page",
    "GO_TO_PAGE_ARIA": "Go to page",
    "LIGHTBOX_CLOSE_ARIA": "Close",
    "LIGHTBOX_PREV_ARIA": "Previous image",
    "LIGHTBOX_NEXT_ARIA": "Next image"
  }
}
```

- [ ] **Step 2: Aggiorna il template**

In `portfolio.html`:
- Hero title/description → `PORTFOLIO.HERO_TITLE` / `HERO_DESCRIPTION`.
- `Caricamento galleria…` → `PORTFOLIO.LOADING`; `Nessuna illustrazione disponibile al momento.` → `PORTFOLIO.EMPTY`; `Nessuna illustrazione in questa categoria.` → `PORTFOLIO.EMPTY_CATEGORY`.
- Nel `@for (cat of categories(); ...)`, lascia `{{ cat.label }}` invariato (è dato Supabase) tranne per il caso `cat.value === 'tutte'`: dato che `label: 'Tutte'` è impostato hardcoded in `portfolio.ts` (`return [{ value: 'tutte', label: 'Tutte' }, ...]`), NON tradurlo lì nel `.ts` — invece nel template usa un controllo: `{{ cat.value === 'tutte' ? ('PORTFOLIO.CATEGORY_ALL' | translate) : cat.label }}`.
- `aria-label="Pagina precedente"` / `"Pagina successiva"` → `[attr.aria-label]="'PORTFOLIO.PREV_PAGE_ARIA' | translate"` / `NEXT_PAGE_ARIA`.
- `[attr.aria-label]="'Vai a pagina ' + (page + 1)"` → `[attr.aria-label]="('PORTFOLIO.GO_TO_PAGE_ARIA' | translate) + ' ' + (page + 1)"`.
- `aria-label="Chiudi"` / `"Immagine precedente"` / `"Immagine successiva"` → rispettivi `LIGHTBOX_*_ARIA`.

Aggiungi `TranslatePipe` a `imports` in `portfolio.ts`.

- [ ] **Step 3: Verifica**

`npm run build` pulito. Sulla pagina Portfolio, passa a EN: hero, stati di caricamento/vuoto e il filtro "Tutte"/"All" cambiano; le altre categorie (es. "Animali") restano in italiano in entrambe le lingue, dato che sono contenuto reale.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n src/app/features/portfolio
git commit -m "feat(i18n): traduce la pagina Portfolio"
```

---

### Task 5: Traduzione Eventi (parti statiche)

**Files:**
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `EVENTI.*`)
- Modify: `src/app/features/eventi/eventi.html`
- Modify: `src/app/features/eventi/eventi.ts`

**Interfaces:**
- Consumes: pipe `translate` globale (Task 1). Per l'interpolazione con un numero (`EVENTI.SEATS_AVAILABLE`), usa la sintassi del pipe con parametro: `{{ 'EVENTI.SEATS_AVAILABLE' | translate:{ count: ev.seatsAvailable } }}`.
- Nota: `ev.title`, `ev.dateLabel`, `ev.luogo`, `ev.indirizzo`, `ev.timeLabel` sono dati Supabase — non toccarli.

- [ ] **Step 1: Aggiungi le chiavi**

`it.json`:
```json
{
  "EVENTI": {
    "HERO_TITLE": "Eventi",
    "HERO_DESCRIPTION": "Vieni a dipingere con me e riscopri la magia della natura. Scopri i prossimi workshop in programma e coltiva la tua creatività in un'atmosfera calda e rilassante.",
    "LOADING": "Caricamento eventi…",
    "EMPTY_TITLE": "Il prossimo workshop sta ancora germogliando",
    "EMPTY_TEXT": "Torna a trovarci tra un po', oppure scopri le illustrazioni che ho già dipinto.",
    "EMPTY_CTA": "Sfoglia il portfolio",
    "CHECKING_SEATS": "Verifica disponibilità in corso…",
    "SOLD_OUT_WARNING": "Attenzione: Posti esauriti per questa data",
    "SEATS_AVAILABLE": "Solo {{count}} posti ancora disponibili",
    "MAP_BUTTON": "Mappa",
    "SOLD_OUT_BUTTON": "Esaurito",
    "BOOK_BUTTON": "Prenotati",
    "SWIPE_HINT": "Scorri per altri eventi",
    "GO_TO_SLIDE_ARIA": "Vai a"
  }
}
```

`en.json`:
```json
{
  "EVENTI": {
    "HERO_TITLE": "Events",
    "HERO_DESCRIPTION": "Come paint with me and rediscover the magic of nature. Check out upcoming workshops and nurture your creativity in a warm, relaxing atmosphere.",
    "LOADING": "Loading events…",
    "EMPTY_TITLE": "The next workshop is still budding",
    "EMPTY_TEXT": "Check back soon, or take a look at the illustrations I've already painted.",
    "EMPTY_CTA": "Browse the portfolio",
    "CHECKING_SEATS": "Checking availability…",
    "SOLD_OUT_WARNING": "Sorry: fully booked for this date",
    "SEATS_AVAILABLE": "Only {{count}} spots left",
    "MAP_BUTTON": "Map",
    "SOLD_OUT_BUTTON": "Sold out",
    "BOOK_BUTTON": "Book now",
    "SWIPE_HINT": "Swipe for more events",
    "GO_TO_SLIDE_ARIA": "Go to"
  }
}
```

- [ ] **Step 2: Aggiorna il template**

In `eventi.html`:
- Hero title/description → `EVENTI.HERO_TITLE` / `HERO_DESCRIPTION`.
- `Caricamento eventi…` → `EVENTI.LOADING`.
- Stato vuoto: `Il prossimo workshop sta ancora germogliando` → `EMPTY_TITLE`; `Torna a trovarci tra un po'...` → `EMPTY_TEXT`; `Sfoglia il portfolio` → `EMPTY_CTA`.
- `Verifica disponibilità in corso…` → `CHECKING_SEATS`; `Attenzione: Posti esauriti per questa data` → `SOLD_OUT_WARNING`.
- `Solo {{ ev.seatsAvailable }} posti ancora disponibili` → `{{ 'EVENTI.SEATS_AVAILABLE' | translate:{ count: ev.seatsAvailable } }}`.
- `Mappa` → `MAP_BUTTON`; `Esaurito` → `SOLD_OUT_BUTTON`; `Prenotati` → `BOOK_BUTTON`.
- `Scorri per altri eventi` → `SWIPE_HINT`.
- `[attr.aria-label]="'Vai a ' + ev.title"` → `[attr.aria-label]="('EVENTI.GO_TO_SLIDE_ARIA' | translate) + ' ' + ev.title"`.

Aggiungi `TranslatePipe` a `imports` in `eventi.ts`.

- [ ] **Step 3: Verifica**

`npm run build` pulito. Se ci sono eventi pubblicati, verifica che badge/bottoni/hint cambino lingua mentre titolo/data/luogo dell'evento restano in italiano; verifica anche lo stato vuoto (nessun evento) in entrambe le lingue.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n src/app/features/eventi
git commit -m "feat(i18n): traduce le parti statiche della pagina Eventi"
```

---

### Task 6: Traduzione EventoDettaglio (parti statiche)

**Files:**
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `EVENTO_DETTAGLIO.*`)
- Modify: `src/app/features/evento-dettaglio/evento-dettaglio.html`
- Modify: `src/app/features/evento-dettaglio/evento-dettaglio.ts`

**Interfaces:**
- Consumes: pipe `translate` globale (Task 1), riusa le chiavi `EVENTI.SOLD_OUT_WARNING` e `EVENTI.SEATS_AVAILABLE` già create in Task 5 (stesso identico testo, non duplicarle).

- [ ] **Step 1: Aggiungi le chiavi**

`it.json`:
```json
{
  "EVENTO_DETTAGLIO": {
    "PAST_EVENT": "Evento concluso",
    "MAP_BUTTON": "Apri mappa",
    "PAST_EVENT_MSG_PRE": "Questo evento si è già svolto. Segui la pagina",
    "PAST_EVENT_MSG_LINK": "Eventi",
    "PAST_EVENT_MSG_POST": "per scoprire i prossimi appuntamenti."
  }
}
```

`en.json`:
```json
{
  "EVENTO_DETTAGLIO": {
    "PAST_EVENT": "Event ended",
    "MAP_BUTTON": "Open map",
    "PAST_EVENT_MSG_PRE": "This event has already taken place. Follow the",
    "PAST_EVENT_MSG_LINK": "Events",
    "PAST_EVENT_MSG_POST": "page to discover upcoming dates."
  }
}
```

- [ ] **Step 2: Aggiorna il template**

In `evento-dettaglio.html`:
- `Evento concluso` → `{{ 'EVENTO_DETTAGLIO.PAST_EVENT' | translate }}`.
- `Attenzione: Posti esauriti per questa data` → `{{ 'EVENTI.SOLD_OUT_WARNING' | translate }}` (chiave riusata da Task 5).
- `Solo {{ event().seatsAvailable }} posti ancora disponibili` → `{{ 'EVENTI.SEATS_AVAILABLE' | translate:{ count: event().seatsAvailable } }}`.
- `Apri mappa` → `{{ 'EVENTO_DETTAGLIO.MAP_BUTTON' | translate }}`.
- Il paragrafo con il link interno:
  ```html
  <p class="text-gray-600 text-sm md:text-base">
    {{ 'EVENTO_DETTAGLIO.PAST_EVENT_MSG_PRE' | translate }}
    <a routerLink="/eventi" class="text-brand underline hover:text-brand-hover">{{ 'EVENTO_DETTAGLIO.PAST_EVENT_MSG_LINK' | translate }}</a>
    {{ 'EVENTO_DETTAGLIO.PAST_EVENT_MSG_POST' | translate }}
  </p>
  ```

Aggiungi `TranslatePipe` a `imports` in `evento-dettaglio.ts`.

- [ ] **Step 3: Verifica**

`npm run build` pulito. Apri una pagina evento dedicata (serve almeno un evento pubblicato, anche passato): verifica badge/bottone mappa/messaggio evento concluso in entrambe le lingue, con titolo/data/luogo dell'evento sempre in italiano.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n src/app/features/evento-dettaglio
git commit -m "feat(i18n): traduce le parti statiche della pagina evento dedicata"
```

---

### Task 7: Traduzione Shop

**Files:**
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `SHOP.*`)
- Modify: `src/app/features/shop/shop.html`
- Modify: `src/app/features/shop/shop.ts`

- [ ] **Step 1: Aggiungi le chiavi**

`it.json`:
```json
{
  "SHOP": {
    "HERO_TITLE": "Shop",
    "HERO_DESCRIPTION": "Porta un pizzico di incanto naturalistico a casa tua: stampe di alta qualità, sticker e segnalibri magici, tutti illustrati con amore. Presto disponibili sul mio shop.",
    "NOTICE_TITLE": "Lo shop apre a Settembre",
    "NOTICE_TEXT": "Sto preparando stampe, sticker e segnalibri con le mie illustrazioni. Seguimi su Instagram per essere tra i primi a saperlo.",
    "INSTAGRAM_BUTTON": "Seguimi su Instagram"
  }
}
```

`en.json`:
```json
{
  "SHOP": {
    "HERO_TITLE": "Shop",
    "HERO_DESCRIPTION": "Bring a touch of natural enchantment home: high-quality prints, stickers and magical bookmarks, all illustrated with love. Coming soon to my shop.",
    "NOTICE_TITLE": "The shop opens in September",
    "NOTICE_TEXT": "I'm preparing prints, stickers and bookmarks with my illustrations. Follow me on Instagram to be among the first to know.",
    "INSTAGRAM_BUTTON": "Follow me on Instagram"
  }
}
```

- [ ] **Step 2: Aggiorna il template**

In `shop.html`, sostituisci le 5 stringhe (hero title/description, notice title/text, bottone Instagram) con i rispettivi `{{ 'SHOP.XXX' | translate }}`. Aggiungi `TranslatePipe` a `imports` in `shop.ts`.

- [ ] **Step 3: Verifica**

`npm run build` pulito. Sulla pagina Shop, passa a EN: hero, avviso e bottone Instagram cambiano.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n src/app/features/shop
git commit -m "feat(i18n): traduce la pagina Shop"
```

---

### Task 8: Traduzione form di prenotazione (etichette, errori, informativa privacy)

**Files:**
- Modify: `src/assets/i18n/it.json`, `en.json` (aggiunge `PRENOTAZIONE_FORM.*`)
- Modify: `src/app/shared/prenotazione-form/prenotazione-form.html`
- Modify: `src/app/shared/prenotazione-form/prenotazione-form.ts`

**Interfaces:**
- Consumes: pipe `translate` globale (Task 1); nel `.ts`, inietta `TranslateService` e usa `.instant('CHIAVE', { param })` per i messaggi costruiti dinamicamente (`errorMessage`).
- Nota: `ev.title`/`ev.dateLabel`/`ev.descrizione` (nel selettore evento) sono dati reali — non tradurli. `'Evento sconosciuto'` (fallback interno per `evento_titolo` salvato su Supabase quando manca l'evento) **non va tradotto**: è un valore salvato nel database che Silvia legge sempre in italiano dal pannello Gestione, indipendentemente dalla lingua del sito pubblico.

- [ ] **Step 1: Aggiungi le chiavi**

`it.json`:
```json
{
  "PRENOTAZIONE_FORM": {
    "TITLE": "Prenota il tuo posto",
    "STEP1_LABEL": "Dati",
    "STEP2_LABEL": "Fatturazione",
    "SECTION1_TITLE": "1. Dati Partecipante",
    "EVENT_SELECT_LABEL": "Seleziona l'evento *",
    "EVENT_SELECT_PLACEHOLDER": "Seleziona un appuntamento...",
    "SEATS_OPTION_PREFIX": "Posti:",
    "NAME_LABEL": "Nome e Cognome *",
    "NAME_PLACEHOLDER": "Emanuela Viola",
    "EMAIL_LABEL": "Email *",
    "EMAIL_PLACEHOLDER": "esempio@email.com",
    "SEATS_LABEL": "Numero di Partecipanti *",
    "SEATS_AVAILABLE_INFO": "Posti disponibili per questo evento: {{seats}} · € {{price}} a persona",
    "SECTION2_TITLE": "2. Fatturazione",
    "BILLING_TYPE_LABEL": "Tipologia Account *",
    "BILLING_PRIVATE_OPTION": "Privato (Ricevuta con Codice Fiscale)",
    "BILLING_BUSINESS_OPTION": "Azienda / Libero Professionista (Fattura con P.IVA)",
    "CF_LABEL": "Codice Fiscale *",
    "COMPANY_NAME_LABEL": "Ragione Sociale *",
    "COMPANY_NAME_PLACEHOLDER": "Studio d'Arte S.r.l.",
    "COMPANY_PIVA_LABEL": "Partita IVA *",
    "COMPANY_PIVA_PLACEHOLDER": "11 cifre numeriche",
    "COMPANY_SDI_LABEL": "Codice Destinatario SDI *",
    "ADDRESS_LABEL": "Via e Numero Civico *",
    "ADDRESS_PLACEHOLDER": "Corso Umberto I, 45",
    "CAP_LABEL": "CAP *",
    "CITY_LABEL": "Città e Provincia *",
    "CITY_PLACEHOLDER": "Taranto (TA)",
    "PRIVACY_PRE": "Ho letto e compreso l'",
    "PRIVACY_LINK": "informativa sulla privacy",
    "SUBMIT_BUTTON": "Invia Iscrizione",
    "SUBMITTING": "Invio in corso...",
    "SUCCESS_TITLE": "Iscrizione salvata! Il tuo posto è riservato: Silvia ti contatterà via email per la conferma.",
    "SUCCESS_SUBTEXT": "Per annullare o modificare la prenotazione, scrivi a Silvia via email o su Instagram.",
    "PRIVACY_TOGGLE": "Informativa sulla privacy",
    "ERR_INVALID_FIELDS": "Controlla i campi evidenziati in rosso: alcuni dati mancano o non sono validi.",
    "ERR_SEATS_SINGULAR": "posto disponibile",
    "ERR_SEATS_PLURAL": "posti disponibili",
    "ERR_NOT_ENOUGH_SEATS": "Solo {{count}} {{word}} per questo evento: riduci il numero di partecipanti o scegli un'altra data.",
    "ERR_GENERIC": "Si è verificato un problema con la registrazione. Riprova.",
    "ERR_SOLD_OUT_RACE": "Ops! I posti per questo evento si sono esauriti un istante fa.",
    "PRIVACY_P1_LABEL": "Titolare del trattamento",
    "PRIVACY_P1_TEXT": "Silvia Sgaramella, P.IVA 03483350736 — contatto per richieste privacy: silvia.sgara@gmail.com",
    "PRIVACY_P2_LABEL": "Dati raccolti",
    "PRIVACY_P2_TEXT": "nome e cognome, email, codice fiscale (per i privati) oppure ragione sociale/partita IVA/codice SDI (per aziende/professionisti), indirizzo, CAP, città.",
    "PRIVACY_P3_LABEL": "Finalità e base giuridica",
    "PRIVACY_P3_TEXT": "i dati sono raccolti per gestire la prenotazione al workshop ed emettere la relativa fattura o ricevuta fiscale — base giuridica: esecuzione del contratto (art. 6.1.b GDPR) e adempimento di obblighi di legge fiscale (art. 6.1.c GDPR).",
    "PRIVACY_P4_LABEL": "Dove sono conservati i dati",
    "PRIVACY_P4_TEXT": "i dati sono ospitati su Supabase (fornitore di database/hosting), che agisce come responsabile del trattamento per conto del titolare.",
    "PRIVACY_P5_LABEL": "Font esterni",
    "PRIVACY_P5_TEXT": "il sito carica i caratteri tipografici direttamente dai server di Google Fonts; il browser si collega a Google, che riceve l'indirizzo IP di chi visita il sito.",
    "PRIVACY_P6_LABEL": "Periodo di conservazione",
    "PRIVACY_P6_TEXT": "i dati relativi a prenotazioni fatturate sono conservati per il periodo previsto dalla normativa fiscale italiana per la documentazione contabile (indicativamente 10 anni, salvo diversa indicazione del proprio commercialista).",
    "PRIVACY_P7_LABEL": "Diritti dell'interessato",
    "PRIVACY_P7_TEXT": "accesso, rettifica, cancellazione, limitazione, opposizione al trattamento e portabilità dei dati, scrivendo a silvia.sgara@gmail.com; è possibile inoltre presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).",
    "PRIVACY_P8_LABEL": "Cookie",
    "PRIVACY_P8_TEXT": "il sito non utilizza cookie di profilazione o tracciamento a fini pubblicitari."
  }
}
```

`en.json`:
```json
{
  "PRENOTAZIONE_FORM": {
    "TITLE": "Reserve your spot",
    "STEP1_LABEL": "Details",
    "STEP2_LABEL": "Billing",
    "SECTION1_TITLE": "1. Participant Details",
    "EVENT_SELECT_LABEL": "Select the event *",
    "EVENT_SELECT_PLACEHOLDER": "Select a date...",
    "SEATS_OPTION_PREFIX": "Spots:",
    "NAME_LABEL": "Full Name *",
    "NAME_PLACEHOLDER": "Jane Smith",
    "EMAIL_LABEL": "Email *",
    "EMAIL_PLACEHOLDER": "example@email.com",
    "SEATS_LABEL": "Number of Participants *",
    "SEATS_AVAILABLE_INFO": "Spots available for this event: {{seats}} · € {{price}} per person",
    "SECTION2_TITLE": "2. Billing",
    "BILLING_TYPE_LABEL": "Account Type *",
    "BILLING_PRIVATE_OPTION": "Individual (Receipt with Tax Code)",
    "BILLING_BUSINESS_OPTION": "Company / Freelancer (Invoice with VAT Number)",
    "CF_LABEL": "Tax Code (Codice Fiscale) *",
    "COMPANY_NAME_LABEL": "Company Name *",
    "COMPANY_NAME_PLACEHOLDER": "Art Studio Ltd.",
    "COMPANY_PIVA_LABEL": "VAT Number *",
    "COMPANY_PIVA_PLACEHOLDER": "11 digits",
    "COMPANY_SDI_LABEL": "SDI Recipient Code *",
    "ADDRESS_LABEL": "Street Address *",
    "ADDRESS_PLACEHOLDER": "123 Main Street",
    "CAP_LABEL": "Postal Code *",
    "CITY_LABEL": "City and Province *",
    "CITY_PLACEHOLDER": "Rome (RM)",
    "PRIVACY_PRE": "I have read and understood the",
    "PRIVACY_LINK": "privacy notice",
    "SUBMIT_BUTTON": "Submit Registration",
    "SUBMITTING": "Submitting...",
    "SUCCESS_TITLE": "Registration saved! Your spot is reserved: Silvia will contact you by email to confirm.",
    "SUCCESS_SUBTEXT": "To cancel or change your booking, message Silvia by email or on Instagram.",
    "PRIVACY_TOGGLE": "Privacy notice",
    "ERR_INVALID_FIELDS": "Please check the fields highlighted in red: some information is missing or invalid.",
    "ERR_SEATS_SINGULAR": "spot available",
    "ERR_SEATS_PLURAL": "spots available",
    "ERR_NOT_ENOUGH_SEATS": "Only {{count}} {{word}} for this event: reduce the number of participants or choose another date.",
    "ERR_GENERIC": "There was a problem with the registration. Please try again.",
    "ERR_SOLD_OUT_RACE": "Oops! The spots for this event just sold out.",
    "PRIVACY_P1_LABEL": "Data controller",
    "PRIVACY_P1_TEXT": "Silvia Sgaramella, VAT 03483350736 — contact for privacy requests: silvia.sgara@gmail.com",
    "PRIVACY_P2_LABEL": "Data collected",
    "PRIVACY_P2_TEXT": "full name, email, tax code (for individuals) or company name/VAT number/SDI code (for companies/freelancers), address, postal code, city.",
    "PRIVACY_P3_LABEL": "Purpose and legal basis",
    "PRIVACY_P3_TEXT": "data is collected to manage your workshop booking and issue the related invoice or tax receipt — legal basis: performance of a contract (art. 6.1.b GDPR) and compliance with tax law obligations (art. 6.1.c GDPR).",
    "PRIVACY_P4_LABEL": "Where data is stored",
    "PRIVACY_P4_TEXT": "data is hosted on Supabase (database/hosting provider), which acts as data processor on behalf of the controller.",
    "PRIVACY_P5_LABEL": "External fonts",
    "PRIVACY_P5_TEXT": "the site loads typefaces directly from Google Fonts' servers; your browser connects to Google, which receives the IP address of the site visitor.",
    "PRIVACY_P6_LABEL": "Retention period",
    "PRIVACY_P6_TEXT": "data relating to invoiced bookings is retained for the period required by Italian tax law for accounting records (approximately 10 years, unless otherwise indicated by your accountant).",
    "PRIVACY_P7_LABEL": "Data subject rights",
    "PRIVACY_P7_TEXT": "access, rectification, erasure, restriction, objection to processing and data portability, by writing to silvia.sgara@gmail.com; you may also lodge a complaint with the Italian Data Protection Authority (www.garanteprivacy.it).",
    "PRIVACY_P8_LABEL": "Cookies",
    "PRIVACY_P8_TEXT": "the site does not use profiling or advertising tracking cookies."
  }
}
```

- [ ] **Step 2: Aggiorna il template**

In `prenotazione-form.html`, sostituisci ogni stringa fissa con la chiave corrispondente (elenco sopra copre tutte le etichette, placeholder, opzioni `<select>`, bottoni). Punti che richiedono attenzione:

- Opzione dinamica evento: `{{ ev.title }} ({{ ev.dateLabel }}) - {{ ev.isSoldOut ? 'SOLD OUT' : 'Posti: ' + ev.seatsAvailable }}` → lascia `SOLD OUT` invariato (già in inglese in entrambe le lingue) e traduci solo il prefisso: `{{ ev.isSoldOut ? 'SOLD OUT' : ('PRENOTAZIONE_FORM.SEATS_OPTION_PREFIX' | translate) + ' ' + ev.seatsAvailable }}`.
- Info posti/prezzo: `Posti disponibili per questo evento: {{ ev.seatsAvailable }} · € {{ ev.prezzo | number: '1.2-2' }} a persona` → `{{ 'PRENOTAZIONE_FORM.SEATS_AVAILABLE_INFO' | translate:{ seats: ev.seatsAvailable, price: (ev.prezzo | number: '1.2-2') } }}`.
- Checkbox privacy: `Ho letto e compreso l'<button ...>informativa sulla privacy</button> *` → `{{ 'PRENOTAZIONE_FORM.PRIVACY_PRE' | translate }} <button type="button" (click)="openPrivacyNotice()" class="text-brand underline hover:text-brand-hover">{{ 'PRENOTAZIONE_FORM.PRIVACY_LINK' | translate }}</button> *`.
- Bottone submit: `{{ submitting() ? 'Invio in corso...' : 'Invia Iscrizione' }}` → `{{ submitting() ? ('PRENOTAZIONE_FORM.SUBMITTING' | translate) : ('PRENOTAZIONE_FORM.SUBMIT_BUTTON' | translate) }}`.
- Le 8 righe dell'informativa privacy, ciascuna nella forma `<p>N. <strong>{{ 'PRENOTAZIONE_FORM.PRIVACY_PN_LABEL' | translate }}</strong>: {{ 'PRENOTAZIONE_FORM.PRIVACY_PN_TEXT' | translate }}</p>` (mantenendo il numero `N.` e i due punti `:` come testo statico del template, NON dentro le chiavi di traduzione).
- CF/SDI/CAP placeholder (`FMTLNZ90A01F205X`, `M5UXCR1`, `74121`): restano invariati, sono esempi di formato identici in entrambe le lingue — non serve creare chiavi per questi tre.

Aggiungi `TranslatePipe` a `imports` in `prenotazione-form.ts`.

- [ ] **Step 3: Aggiorna i messaggi dinamici in TypeScript**

In `prenotazione-form.ts`, inietta il servizio e sostituisci le stringhe hardcoded nei `set` di `errorMessage`:
```ts
import { TranslateService } from '@ngx-translate/core';
// ...
private readonly translate = inject(TranslateService);
```
- `'Controlla i campi evidenziati in rosso: alcuni dati mancano o non sono validi.'` → `this.translate.instant('PRENOTAZIONE_FORM.ERR_INVALID_FIELDS')`.
- Il blocco pluralizzato:
  ```ts
  const postiParola = currentSeats === 1
    ? this.translate.instant('PRENOTAZIONE_FORM.ERR_SEATS_SINGULAR')
    : this.translate.instant('PRENOTAZIONE_FORM.ERR_SEATS_PLURAL');
  this.errorMessage.set(
    this.translate.instant('PRENOTAZIONE_FORM.ERR_NOT_ENOUGH_SEATS', { count: currentSeats, word: postiParola }),
  );
  ```
- `'Si è verificato un problema con la registrazione. Riprova.'` → `this.translate.instant('PRENOTAZIONE_FORM.ERR_GENERIC')`.
- `'Ops! I posti per questo evento si sono esauriti un istante fa.'` → `this.translate.instant('PRENOTAZIONE_FORM.ERR_SOLD_OUT_RACE')`.
- **Non toccare** `'Evento sconosciuto'` (resta hardcoded in italiano, vedi nota in Interfaces).

- [ ] **Step 4: Verifica**

`npm run build` pulito. Nella pagina Eventi (o EventoDettaglio), passa a EN e verifica: tutte le etichette del form, i placeholder, i due bottoni tab "Dati"/"Fatturazione", l'informativa privacy (apri il pannello, controlla tutte le 8 righe), e prova a scatenare almeno un messaggio di errore (es. invia con campi vuoti) per vedere `ERR_INVALID_FIELDS` tradotto. Verifica anche che passando a "Azienda/Freelancer" le etichette Ragione Sociale/Partita IVA/SDI cambino lingua correttamente.

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n src/app/shared/prenotazione-form
git commit -m "feat(i18n): traduce il form di prenotazione e l'informativa privacy"
```

---

### Task 9: Revisione finale e verifica di coerenza

**Files:** nessuna modifica di codice prevista; solo verifica. Se la revisione trova stringhe dimenticate, questo task le corregge nei file pertinenti.

- [ ] **Step 1: Verifica sistematica pagina per pagina**

`npm run build` pulito, poi `npm start`. Per ciascuna delle 6 pagine pubbliche (Home, Portfolio, Eventi, EventoDettaglio con un evento reale, Shop, e il footer/navbar su ogni pagina):
1. Apri la pagina in italiano, leggi tutto il testo visibile.
2. Passa a EN col toggle, rileggi tutto: nessuna stringa deve restare in italiano tra quelle elencate nei task precedenti, e nessun testo deve apparire come una chiave grezza non tradotta (es. `HOME.TAGLINE` mostrato letteralmente sullo schermo — segno di una chiave mancante nel dizionario).
3. Conferma che i contenuti Supabase (titoli/date/luoghi eventi, categorie e titoli portfolio) restino sempre in italiano in entrambe le lingue.
4. Ricarica la pagina: la lingua scelta deve persistere.
5. Naviga tra pagine diverse: la lingua scelta deve restare la stessa (non deve tornare a IT cambiando rotta).

- [ ] **Step 2: Verifica `/gestione-prenotazioni`**

Conferma che il pannello Gestione non mostri l'interruttore lingua e resti interamente in italiano indipendentemente dalla scelta fatta sul sito pubblico (dato che `LanguageService`/`TranslateService` sono globali a livello di app, il pannello Gestione NON deve usare il pipe `translate` da nessuna parte — verifica che nessuna chiave sia stata aggiunta per errore ai suoi componenti).

- [ ] **Step 3: Correggi eventuali stringhe dimenticate**

Se il giro di verifica trova testo non tradotto, aggiungi la chiave mancante a `it.json`/`en.json` e aggiorna il template pertinente, seguendo lo stesso stile delle chiavi già presenti.

- [ ] **Step 4: Commit finale (solo se Step 3 ha trovato correzioni)**

```bash
git add -A
git commit -m "fix(i18n): corregge stringhe rimaste non tradotte durante la revisione finale"
```
