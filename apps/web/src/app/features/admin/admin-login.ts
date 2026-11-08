import { Component, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminSessionService, safeAdminReturnUrl } from './admin-session.service';

@Component({
  selector: 'app-admin-login',
  imports: [RouterLink],
  templateUrl: './admin-login.html',
})
export class AdminLogin implements OnInit {
  readonly session = inject(AdminSessionService);
  readonly busy = signal(false);
  readonly error = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  get returnUrl(): string {
    return safeAdminReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  async ngOnInit(): Promise<void> {
    if (await this.session.accessToken()) {
      await this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
    }
  }

  async enter(): Promise<void> {
    if (!this.session.configured || this.busy()) return;
    this.error.set(false);
    this.busy.set(true);
    try {
      await this.session.beginLogin(this.returnUrl);
    } catch {
      this.error.set(true);
      this.busy.set(false);
    }
  }
}
