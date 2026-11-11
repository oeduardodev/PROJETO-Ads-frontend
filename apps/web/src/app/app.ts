import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PageMetadataService } from './core/seo/page-metadata.service';

@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  readonly mobileMenuOpen = signal(false);
  readonly mobileMenuButton = viewChild<ElementRef<HTMLButtonElement>>('mobileMenuButton');

  constructor() {
    inject(PageMetadataService);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen()) return;
    this.mobileMenuOpen.set(false);
    this.mobileMenuButton()?.nativeElement.focus();
  }
}
