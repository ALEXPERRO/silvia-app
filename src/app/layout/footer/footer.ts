import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentService } from '../../core/services/content.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  private readonly content = inject(ContentService);
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  protected readonly footer = this.content.footer;

  protected readonly newsletterForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly newsletterSubmitting = signal(false);
  protected readonly newsletterSuccess = signal(false);
  protected readonly newsletterError = signal<string | null>(null);

  async onNewsletterSubmit(): Promise<void> {
    this.newsletterError.set(null);

    if (this.newsletterForm.invalid) {
      this.newsletterForm.markAllAsTouched();
      return;
    }

    this.newsletterSubmitting.set(true);
    const email = this.newsletterForm.getRawValue().email;

    const { error } = await this.supabase.insertNewsletterSignup(email);

    if (error) {
      const isDuplicate = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
      this.newsletterError.set(isDuplicate ? 'Questa email è già iscritta.' : 'Si è verificato un problema. Riprova.');
      this.newsletterSubmitting.set(false);
      return;
    }

    this.newsletterSubmitting.set(false);
    this.newsletterSuccess.set(true);
  }
}
