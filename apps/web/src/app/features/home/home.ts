import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  readonly searchTerm = signal('');
  private readonly router = inject(Router);

  submitSearch(event: Event): void {
    event.preventDefault();
    const query = this.searchTerm().trim();
    void this.router.navigate(['/oportunidades'], {
      queryParams: query ? { q: query } : {},
    });
  }
}
