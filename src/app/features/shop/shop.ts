import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { ShopPreviewItem } from '../../core/models/shop-preview.model';
import { ContentService } from '../../core/services/content.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [Icon, TranslatePipe],
  templateUrl: './shop.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shop {
  protected readonly shopUrl = inject(ContentService).shopUrl;
  protected readonly previewItems = signal<ShopPreviewItem[]>([]);
  protected readonly previewLoading = signal(true);

  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Stampe, sticker e segnalibri illustrati ad acquerello di Silvia Sgaramella: il negozio Blooming Wild ART è ora aperto su Etsy.',
    });

    // Le anteprime arrivano dal feed Etsy via /api/shop-preview: caricate solo
    // lato client, la pagina resta prerenderizzabile senza dipendere da Etsy in fase di build.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      fetch('/api/shop-preview')
        .then((res) => (res.ok ? (res.json() as Promise<ShopPreviewItem[]>) : []))
        .then((items) => this.previewItems.set(items))
        .catch(() => this.previewItems.set([]))
        .finally(() => this.previewLoading.set(false));
    } else {
      this.previewLoading.set(false);
    }
  }
}
