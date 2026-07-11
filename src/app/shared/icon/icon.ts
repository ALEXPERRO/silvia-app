import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type IconName =
  | 'calendar'
  | 'map-pin'
  | 'map'
  | 'ticket'
  | 'sparkles'
  | 'alert-triangle'
  | 'ban'
  | 'x'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'leaf'
  | 'instagram'
  | 'tiktok';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width.px]': 'size',
    '[style.height.px]': 'size',
    class: 'inline-flex shrink-0',
  },
})
export class Icon {
  @Input({ required: true }) name!: IconName;
  @Input() size = 16;
}
