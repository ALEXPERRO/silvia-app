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
