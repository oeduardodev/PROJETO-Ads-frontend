import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-opportunities-preview',
  imports: [RouterLink],
  template: `
    <main id="conteudo" class="opportunities-preview" aria-labelledby="preview-title">
      <p class="hero__eyebrow">Catálogo em preparação</p>
      <h1 id="preview-title">Estamos preparando a busca.</h1>
      <p>
        Esta instalação ainda não tem processos verificados para exibir. Isso não indica ausência de
        oportunidades nas instituições. Consulte os editais e calendários nos portais oficiais.
      </p>
      <a class="explore__cta" routerLink="/">Voltar ao início <span aria-hidden="true">→</span></a>
      <p class="preview-note">
        Os documentos oficiais e as páginas das instituições prevalecem sobre qualquer resumo.
      </p>
    </main>
  `,
  styles: `
    .opportunities-preview {
      display: grid;
      width: min(100% - 2rem, 58rem);
      min-height: 45vh;
      align-content: center;
      justify-items: start;
      gap: 1rem;
      margin-inline: auto;
      padding-block: 3rem;
    }
    .opportunities-preview h1 {
      max-width: 12ch;
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(2.5rem, 7vw, 5.5rem);
      letter-spacing: -0.06em;
      line-height: 0.95;
      text-transform: uppercase;
    }
    .opportunities-preview > p:not(.hero__eyebrow, .official-note) {
      max-width: 42rem;
      font-size: clamp(1.1rem, 2.4vw, 1.4rem);
      line-height: 1.5;
    }
    .preview-note {
      padding: 0.8rem 1rem;
      border: 2px solid var(--color-ink);
      background: var(--color-lime);
      font-weight: 850;
    }
  `,
})
export class OpportunitiesPreview {}
