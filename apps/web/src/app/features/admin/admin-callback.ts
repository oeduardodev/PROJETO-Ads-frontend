import { Component, inject, signal, type OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminSessionService } from './admin-session.service';

@Component({
  selector: 'app-admin-callback',
  imports: [RouterLink],
  templateUrl: './admin-callback.html',
})
export class AdminCallback implements OnInit {
  readonly failed = signal(false);
  private readonly session = inject(AdminSessionService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    try {
      const returnUrl = await this.session.completeLogin();
      await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    } catch {
      this.failed.set(true);
    }
  }
}
