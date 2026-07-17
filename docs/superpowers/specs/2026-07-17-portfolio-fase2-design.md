# Gestione Portfolio — Fase 2: pannello di amministrazione

**Contesto:** la Fase 1 ha spostato i metadati delle 126 immagini esistenti dal
codice al database (`portfolio_immagini`) e ha ricablato la pagina pubblica
Portfolio per leggerli da lì. Questa Fase 2 costruisce la UI che permette a
Silvia di caricare nuove immagini, riordinarle, modificarle e nasconderle da
sola, riusando il login già esistente di `/gestione-prenotazioni`.

## Sezione 1 — Permessi database e Storage

```sql
-- Silvia (autenticata) può creare e modificare immagini portfolio. Nessuna
-- policy di delete: si nascondono (pubblicato = false), non si eliminano mai.
create policy "portfolio_immagini_insert_autenticato"
  on portfolio_immagini for insert to authenticated with check (true);

create policy "portfolio_immagini_update_autenticato"
  on portfolio_immagini for update to authenticated using (true) with check (true);

-- Bucket pubblico per le immagini portfolio caricate da Silvia (quelle già
-- esistenti restano in public/images/, solo le nuove finiscono qui).
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "portfolio_select_pubblico" on storage.objects;
create policy "portfolio_select_pubblico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "portfolio_insert_autenticato" on storage.objects;
create policy "portfolio_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio');
```

Nessuna policy di `delete` — coerente con "nascondi, mai elimina" già adottato
per eventi. Nessun limite di dimensione/tipo file lato database (accettato
esplicitamente, come per le locandine).

## Sezione 2 — Nuova dipendenza: Angular CDK (drag & drop)

Il riordino manuale delle immagini richiede il trascinamento — le API native
del browser non funzionano al tocco su mobile, quindi si usa
`@angular/cdk/drag-drop` (libreria ufficiale Angular, supporta touch e
tastiera). È la prima dipendenza di questo progetto oltre ad Angular/Tailwind/
Supabase.

```bash
npm install @angular/cdk@^20.3.0
```

## Sezione 3 — Modelli e metodi `AdminService`

**Nuovo modello** in `src/app/core/models/gallery-item.model.ts`, accanto a
`GalleryItem`/`GalleryCategoryOption` già esistenti dalla Fase 1:

```ts
/** Vista admin di un'immagine portfolio: espone anche lo stato di pubblicazione,
 *  che il pubblico non deve mai vedere/gestire. */
export interface GalleryItemAdmin extends GalleryItem {
  pubblicato: boolean;
}
```

**Nuovi metodi** in `src/app/core/services/admin.service.ts`, stesso stile di
quelli già esistenti per eventi (`getAllEvents`, `uploadLocandina`, ecc.):

```ts
/** Tutte le immagini portfolio (pubblicate e nascoste), ordinate per categoria poi ordine. */
async getAllPortfolioItems(): Promise<GalleryItemAdmin[]> {
  const client = await this.getClient();
  const { data, error } = await client
    .from('portfolio_immagini')
    .select('*')
    .order('categoria', { ascending: true })
    .order('ordine', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row['id'],
    src: row['src'],
    title: row['titolo'],
    category: row['categoria'],
    ordine: row['ordine'],
    pubblicato: row['pubblicato'],
  }));
}

async uploadPortfolioImage(file: File): Promise<{ url: string | null; error: unknown }> {
  const client = await this.getClient();
  const path = `${crypto.randomUUID()}-${file.name}`;
  const { error } = await client.storage.from('portfolio').upload(path, file);
  if (error) return { url: null, error };
  const { data } = client.storage.from('portfolio').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

/** Inserisce più immagini insieme (upload multiplo), già con src/titolo/categoria/ordine calcolati dal chiamante. */
async createPortfolioItems(
  items: { src: string; titolo: string; categoria: string; ordine: number }[],
): Promise<{ error: unknown }> {
  const client = await this.getClient();
  const { error } = await client.from('portfolio_immagini').insert(
    items.map((i) => ({ src: i.src, titolo: i.titolo, categoria: i.categoria, ordine: i.ordine })),
  );
  return { error };
}

async updatePortfolioItem(
  id: number,
  titolo: string,
  categoria: string,
  ordine: number,
): Promise<{ error: unknown }> {
  const client = await this.getClient();
  const { error } = await client
    .from('portfolio_immagini')
    .update({ titolo, categoria, ordine })
    .eq('id', id);
  return { error };
}

async togglePortfolioPubblicato(id: number, pubblicato: boolean): Promise<{ error: unknown }> {
  const client = await this.getClient();
  const { error } = await client.from('portfolio_immagini').update({ pubblicato }).eq('id', id);
  return { error };
}

/** Dopo un trascinamento: salva il nuovo ordine di tutte le immagini della categoria toccata
 *  (una update per riga: nessuna funzione SQL dedicata, il numero di immagini per
 *  categoria è troppo piccolo per giustificarne una). */
async reorderPortfolioItems(updates: { id: number; ordine: number }[]): Promise<{ error: unknown }> {
  const client = await this.getClient();
  const results = await Promise.all(
    updates.map((u) => client.from('portfolio_immagini').update({ ordine: u.ordine }).eq('id', u.id)),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error ?? null };
}
```

## Sezione 4 — Struttura pagina `/gestione-prenotazioni`

`activeTab` passa da `'prenotazioni' | 'eventi'` a
`'prenotazioni' | 'eventi' | 'portfolio'`: terzo pulsante nello switcher già
esistente, stesso stile. `selectTab()` carica i dati della scheda Portfolio la
prima volta che viene selezionata (stesso pattern lazy-load già usato per
Eventi):

```ts
selectTab(tab: 'prenotazioni' | 'eventi' | 'portfolio'): void {
  this.activeTab.set(tab);
  if (tab === 'eventi' && !this.eventsTabLoaded()) {
    this.admin.getAllEvents().then((events) => {
      this.adminEvents.set(events);
      this.eventsTabLoaded.set(true);
    });
  }
  if (tab === 'portfolio' && !this.portfolioTabLoaded()) {
    this.admin.getAllPortfolioItems().then((items) => {
      this.adminPortfolio.set(items);
      this.portfolioTabLoaded.set(true);
    });
  }
}
```

## Sezione 5 — Elenco immagini con drag & drop

Nuovo stato in `gestione.ts`:

```ts
protected readonly adminPortfolio = signal<GalleryItemAdmin[]>([]);
protected readonly portfolioTabLoaded = signal(false);
protected readonly portfolioActionError = signal<string | null>(null);

protected readonly groupedPortfolio = computed(() => {
  const groups = new Map<string, GalleryItemAdmin[]>();
  for (const item of this.adminPortfolio()) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category)!.push(item);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
});

protected readonly existingCategorie = computed(() =>
  Array.from(new Set(this.adminPortfolio().map((i) => i.category))),
);
```

`gestione.ts` importa `DragDropModule`, `CdkDragDrop`, `moveItemInArray` da
`@angular/cdk/drag-drop` (il componente aggiunge `DragDropModule` al proprio
array `imports`):

```ts
async onPortfolioDrop(event: CdkDragDrop<GalleryItemAdmin[]>, group: { items: GalleryItemAdmin[] }): Promise<void> {
  moveItemInArray(group.items, event.previousIndex, event.currentIndex);
  const updates = group.items.map((item, i) => ({ id: item.id, ordine: i }));
  updates.forEach((u, i) => (group.items[i].ordine = u.ordine));
  this.portfolioActionError.set(null);
  const { error } = await this.admin.reorderPortfolioItems(updates);
  if (error) this.portfolioActionError.set('Impossibile salvare il nuovo ordine. Riprova.');
}

async togglePortfolioPubblicato(item: GalleryItemAdmin): Promise<void> {
  this.portfolioActionError.set(null);
  try {
    const { error } = await this.admin.togglePortfolioPubblicato(item.id, !item.pubblicato);
    if (error) {
      this.portfolioActionError.set("Impossibile aggiornare lo stato dell'immagine. Riprova.");
      return;
    }
    this.adminPortfolio.update((list) =>
      list.map((i) => (i.id === item.id ? { ...i, pubblicato: !item.pubblicato } : i)),
    );
  } catch {
    this.portfolioActionError.set("Impossibile aggiornare lo stato dell'immagine. Riprova.");
  }
}
```

Template (all'interno del nuovo ramo `activeTab() === 'portfolio'`). La
`<datalist>` dei suggerimenti categoria è dichiarata qui, allo stesso livello
del resto della scheda (non annidata dentro il form di aggiunta), così è
disponibile sia al form di aggiunta sia a quello di modifica indipendentemente
da quale dei due sia aperto:

```html
<datalist id="categorie-esistenti">
  @for (c of existingCategorie(); track c) {
    <option [value]="c"></option>
  }
</datalist>

@if (portfolioActionError(); as err) {
  <p class="text-red-500 text-xs font-semibold text-center mb-6">{{ err }}</p>
}

@if (!showAddPortfolioForm() && !editingPortfolioItem()) {
  <button type="button" (click)="openAddPortfolioForm()" class="bg-action text-white text-xs font-semibold tracking-widest uppercase px-5 py-3 rounded mb-6 hover:bg-action-hover transition-colors">
    + Aggiungi immagini
  </button>
}

@if (adminPortfolio().length === 0 && portfolioTabLoaded()) {
  <p class="text-gray-600 text-sm">Nessuna immagine ancora.</p>
}

@for (group of groupedPortfolio(); track group.category) {
  <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
    <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">{{ group.category }}</h2>
    <div cdkDropList (cdkDropListDropped)="onPortfolioDrop($event, group)" class="space-y-2">
      @for (item of group.items; track item.id) {
        <div cdkDrag class="flex items-center gap-3 py-2 border-t border-gray-200 first:border-t-0 bg-white">
          <span cdkDragHandle class="cursor-move text-gray-400 hover:text-gray-600 shrink-0 text-lg">⠿</span>
          <img [src]="item.src" [alt]="item.title" class="w-12 h-12 object-cover rounded border border-gray-200 shrink-0">
          <p class="flex-1 text-sm font-medium text-gray-900">
            {{ item.title }}
            <span
              class="text-[10px] font-semibold tracking-widest uppercase px-2 py-1 rounded ml-2"
              [ngClass]="item.pubblicato ? 'bg-action text-white' : 'bg-gray-200 text-gray-600'"
            >{{ item.pubblicato ? 'Pubblicato' : 'Nascosto' }}</span>
          </p>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" (click)="openEditPortfolioForm(item)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">Modifica</button>
            <button type="button" (click)="togglePortfolioPubblicato(item)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">
              {{ item.pubblicato ? 'Nascondi' : 'Pubblica' }}
            </button>
          </div>
        </div>
      }
    </div>
  </div>
}
```

## Sezione 6 — Caricamento multiplo e modifica

**Stato** in `gestione.ts`:

```ts
protected readonly showAddPortfolioForm = signal(false);
protected readonly newPortfolioCategoria = signal('');
protected readonly newPortfolioRows = signal<{ file: File; titolo: string; previewUrl: string }[]>([]);
protected readonly savingPortfolio = signal(false);
protected readonly portfolioFormError = signal<string | null>(null);

protected readonly editingPortfolioItem = signal<GalleryItemAdmin | null>(null);
protected readonly editPortfolioForm = this.fb.nonNullable.group({
  titolo: ['', Validators.required],
  categoria: ['', Validators.required],
});
```

**Metodi**:

```ts
openAddPortfolioForm(): void {
  this.portfolioFormError.set(null);
  this.newPortfolioCategoria.set('');
  this.newPortfolioRows.set([]);
  this.showAddPortfolioForm.set(true);
}

closeAddPortfolioForm(): void {
  this.showAddPortfolioForm.set(false);
}

onPortfolioFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  this.newPortfolioRows.set(files.map((file) => ({ file, titolo: '', previewUrl: URL.createObjectURL(file) })));
}

updatePortfolioRowTitle(index: number, titolo: string): void {
  this.newPortfolioRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, titolo } : r)));
}

private nextOrdineForCategoria(categoria: string): number {
  const existing = this.adminPortfolio().filter((i) => i.category === categoria);
  return existing.length > 0 ? Math.max(...existing.map((i) => i.ordine)) + 1 : 0;
}

async onSubmitAddPortfolio(): Promise<void> {
  this.portfolioFormError.set(null);
  const categoria = this.newPortfolioCategoria().trim();
  const rows = this.newPortfolioRows();

  if (!categoria) {
    this.portfolioFormError.set('Scegli o scrivi una categoria.');
    return;
  }
  if (rows.length === 0) {
    this.portfolioFormError.set('Seleziona almeno un file.');
    return;
  }
  if (rows.some((r) => !r.titolo.trim())) {
    this.portfolioFormError.set('Ogni immagine ha bisogno di un titolo.');
    return;
  }

  this.savingPortfolio.set(true);
  try {
    let nextOrdine = this.nextOrdineForCategoria(categoria);
    const items: { src: string; titolo: string; categoria: string; ordine: number }[] = [];

    for (const row of rows) {
      const { url, error } = await this.admin.uploadPortfolioImage(row.file);
      if (error || !url) {
        this.portfolioFormError.set(`Impossibile caricare "${row.file.name}". Riprova.`);
        return;
      }
      items.push({ src: url, titolo: row.titolo.trim(), categoria, ordine: nextOrdine });
      nextOrdine++;
    }

    const { error } = await this.admin.createPortfolioItems(items);
    if (error) {
      this.portfolioFormError.set('Immagini caricate ma non salvate nel database. Riprova.');
      return;
    }

    this.showAddPortfolioForm.set(false);
    this.portfolioTabLoaded.set(false);
    this.selectTab('portfolio');
  } catch {
    this.portfolioFormError.set('Impossibile completare il caricamento. Riprova.');
  } finally {
    this.savingPortfolio.set(false);
  }
}

openEditPortfolioForm(item: GalleryItemAdmin): void {
  this.editingPortfolioItem.set(item);
  this.portfolioFormError.set(null);
  this.editPortfolioForm.reset({ titolo: item.title, categoria: item.category });
}

closeEditPortfolioForm(): void {
  this.editingPortfolioItem.set(null);
}

async onSubmitEditPortfolio(): Promise<void> {
  this.portfolioFormError.set(null);
  if (this.editPortfolioForm.invalid) {
    this.editPortfolioForm.markAllAsTouched();
    return;
  }
  const item = this.editingPortfolioItem();
  if (!item) return;

  const { titolo, categoria } = this.editPortfolioForm.getRawValue();
  const categoriaTrim = categoria.trim();
  const ordine = categoriaTrim !== item.category ? this.nextOrdineForCategoria(categoriaTrim) : item.ordine;

  this.savingPortfolio.set(true);
  try {
    const { error } = await this.admin.updatePortfolioItem(item.id, titolo.trim(), categoriaTrim, ordine);
    if (error) {
      this.portfolioFormError.set("Impossibile salvare le modifiche. Riprova.");
      return;
    }
    this.editingPortfolioItem.set(null);
    this.portfolioTabLoaded.set(false);
    this.selectTab('portfolio');
  } catch {
    this.portfolioFormError.set("Impossibile salvare le modifiche. Riprova.");
  } finally {
    this.savingPortfolio.set(false);
  }
}
```

**Template — form di caricamento multiplo** (mostrato solo quando
`showAddPortfolioForm()` è vero; il pulsante "+ Aggiungi immagini" che lo apre
è nascosto quando questo form o quello di modifica sono aperti):

```html
@if (showAddPortfolioForm()) {
  <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
    <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">Aggiungi immagini</h2>

    <div class="mb-4">
      <label for="new-portfolio-categoria" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Categoria *</label>
      <input
        type="text"
        id="new-portfolio-categoria"
        list="categorie-esistenti"
        [value]="newPortfolioCategoria()"
        (input)="newPortfolioCategoria.set($any($event.target).value)"
        placeholder="Scegli o scrivi una categoria"
        class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800"
      />
    </div>

    <div class="mb-4">
      <label for="new-portfolio-files" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Immagini *</label>
      <input type="file" id="new-portfolio-files" accept="image/*" multiple (change)="onPortfolioFilesSelected($event)" class="w-full text-sm text-gray-600">
    </div>

    @if (newPortfolioRows().length > 0) {
      <div class="space-y-3 mb-4">
        @for (row of newPortfolioRows(); track row.previewUrl; let i = $index) {
          <div class="flex items-center gap-3">
            <img [src]="row.previewUrl" alt="" class="w-16 h-16 object-cover rounded border border-gray-200 shrink-0">
            <input
              type="text"
              [value]="row.titolo"
              (input)="updatePortfolioRowTitle(i, $any($event.target).value)"
              placeholder="Titolo di questa immagine"
              class="flex-1 p-2.5 border border-gray-200 rounded focus:border-brand focus:outline-none text-sm text-gray-800"
            />
          </div>
        }
      </div>
    }

    @if (portfolioFormError(); as err) {
      <p class="text-red-500 text-xs font-semibold text-center mb-4">{{ err }}</p>
    }

    <div class="flex items-center gap-3">
      <button type="button" [disabled]="savingPortfolio()" (click)="onSubmitAddPortfolio()" class="bg-action text-white font-medium text-xs tracking-widest py-3 px-6 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
        {{ savingPortfolio() ? 'Caricamento...' : 'Salva immagini' }}
      </button>
      <button type="button" (click)="closeAddPortfolioForm()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 border border-gray-200 rounded px-6 py-3 hover:border-brand hover:text-brand transition-colors">
        Annulla
      </button>
    </div>
  </div>
}
```

**Template — form di modifica** (mostrato solo quando `editingPortfolioItem()`
non è `null`):

```html
@if (editingPortfolioItem(); as item) {
  <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
    <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">Modifica immagine</h2>
    <form [formGroup]="editPortfolioForm" (ngSubmit)="onSubmitEditPortfolio()" class="space-y-4 text-left text-sm">
      <div>
        <label for="edit-portfolio-titolo" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Titolo *</label>
        <input type="text" id="edit-portfolio-titolo" formControlName="titolo" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
      </div>
      <div>
        <label for="edit-portfolio-categoria" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Categoria *</label>
        <input type="text" id="edit-portfolio-categoria" formControlName="categoria" list="categorie-esistenti" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
      </div>
      @if (portfolioFormError(); as err) {
        <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
      }
      <div class="flex items-center gap-3">
        <button type="submit" [disabled]="savingPortfolio()" class="bg-action text-white font-medium text-xs tracking-widest py-3 px-6 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
          {{ savingPortfolio() ? 'Salvataggio...' : 'Salva modifiche' }}
        </button>
        <button type="button" (click)="closeEditPortfolioForm()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 border border-gray-200 rounded px-6 py-3 hover:border-brand hover:text-brand transition-colors">
          Annulla
        </button>
      </div>
    </form>
  </div>
}
```

**Ordine di assemblaggio nel template finale** (le sezioni precedenti
presentano i pezzi in ordine logico, non nell'ordine in cui compaiono nel
file): all'interno del ramo `activeTab() === 'portfolio'`, l'ordine è
`<datalist>` condivisa → `portfolioActionError` → pulsante "+ Aggiungi
immagini" (Sezione 5) → form di aggiunta (Sezione 6) → form di modifica
(Sezione 6) → messaggio elenco vuoto → elenco raggruppato con drag & drop
(Sezione 5).

## Sezione 7 — Adeguamento pagina pubblica Portfolio

`src/app/features/portfolio/portfolio.html` passa da `NgOptimizedImage`
(`[ngSrc]` + `fill`) a un `<img>` normale, sia nella griglia che nella
lightbox, così le immagini vecchie (percorso locale) e quelle nuove (URL
assoluto Supabase Storage) si comportano allo stesso modo senza dover
configurare un loader Angular dedicato per il dominio Supabase:

```html
<!-- Griglia: da -->
<img [ngSrc]="item.src" fill loading="lazy" [alt]="item.title" class="object-contain p-4 ..." ... />
<!-- a -->
<img [src]="item.src" loading="lazy" [alt]="item.title" class="absolute inset-0 w-full h-full object-contain p-4 ..." ... />

<!-- Lightbox: da -->
<img [ngSrc]="item.src" fill [alt]="item.title" class="object-contain p-6" ... />
<!-- a -->
<img [src]="item.src" [alt]="item.title" class="absolute inset-0 w-full h-full object-contain p-6" ... />
```

`NgOptimizedImage`/`fill` non serve più: il componente `portfolio.ts` perde
l'import `NgOptimizedImage` da `@angular/common` (non più usato).

## Nota architetturale (non un'azione per questa fase)

`gestione.ts`/`gestione.html` arrivano a gestire tre schede (Prenotazioni,
Eventi, Portfolio) in un solo file, superando abbondantemente le 300 righe.
Non lo splitto in questa fase (nessun problema concreto oggi, e frammentarlo
ora costerebbe più di quanto risolva) — ma se una futura Fase 3 aggiungesse
un'altra scheda, varrebbe la pena separare ciascuna scheda nel proprio
componente figlio.

## Cosa NON fa questa fase

- Nessuna eliminazione definitiva di un'immagine (solo nascondi/pubblica).
- Nessuna sostituzione del file immagine di un'immagine già caricata (solo
  titolo/categoria modificabili — per cambiare la foto, Silvia nasconde
  quella vecchia e ne carica una nuova).
- Nessuna pulizia automatica dei file rimpiazzati nel bucket Storage.
- Nessun limite di dimensione/tipo file lato database.
- Nessuna modifica alle pagine Eventi, Home, Shop, o alla scheda Prenotazioni
  esistente in `/gestione-prenotazioni`.
