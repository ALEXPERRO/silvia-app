import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [Icon, TranslatePipe],
  templateUrl: './shop.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shop {
  constructor() {
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Stampe, sticker e segnalibri illustrati ad acquerello di Silvia Sgaramella: lo shop di Blooming Wild ART apre a Settembre.',
    });
  }
}
