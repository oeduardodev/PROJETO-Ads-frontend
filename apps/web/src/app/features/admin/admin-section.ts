import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-section',
  template: `
    <div class="admin-placeholder">
      <span class="admin-placeholder__stamp">Área interna</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
  `,
})
export class AdminSection {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly description = this.route.snapshot.data['description'] as string;
}
