import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { BottomNav } from './layout/bottom-nav/bottom-nav';
import { Footer } from './layout/footer/footer';
import { SupabaseService } from './core/services/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, BottomNav, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    const supabase = inject(SupabaseService);

    afterNextRender(() => {
      // scalda la cache dei posti disponibili: atterrando su Eventi
      // il badge esaurito/disponibili è corretto fin dal primo render
      supabase.getEventSeats();
    });
  }
}
