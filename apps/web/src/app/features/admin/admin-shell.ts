import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminSessionService } from './admin-session.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.html',
})
export class AdminShell {
  readonly session = inject(AdminSessionService);
  readonly signingOut = signal(false);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.session.signOut();
      await this.router.navigateByUrl('/admin/login', { replaceUrl: true });
    } finally {
      this.signingOut.set(false);
    }
  }
}
