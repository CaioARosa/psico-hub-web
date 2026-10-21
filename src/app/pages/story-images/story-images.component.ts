import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Stories estáticos (9:16 · 1080x1920) para Instagram — modo captura.
 * Rotas: /story-image/1 (gancho/reflexão + enquete) e /story-image/3 (CTA + figurinha de link).
 * O quadro preenche exatamente a viewport (100vw, 9/16). Medidas em `cqw` (1080px = 100cqw; 1920px = 177.8cqw).
 * Zonas seguras do Instagram: topo ~250px (23cqw) e base ~340px (31.5cqw) sem conteúdo importante.
 */
@Component({
  selector: 'app-story-images',
  standalone: true,
  template: `
    <div class="frame">
      <div class="blob b1"></div>
      <div class="blob b2"></div>

      @if (n === 3) {
        <!-- STORY 3 · CTA — Versão minimalista com a Árvore da Vida -->
        <section class="s3">
          <img src="assets/tree-logo.png" alt="Lays Coelho Psicologia" class="s3-logo" />
          <h1 class="display title3">O primeiro passo<br /><em>pode ser hoje</em></h1>
          <p class="url">layspsi.com.br</p>
          <p class="hint">Toque no link abaixo</p>
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
               stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          <div class="sticker-zone"></div>
          <p class="crp">Lays Coelho · Psicóloga Clínica · CRP 04/67406</p>
        </section>
      } @else {
        <!-- STORY 1 · Gancho — com a Árvore da Marca -->
        <img src="assets/lays_coelho_profile3.jpeg" alt="" class="bg-photo" />
        <div class="bg-fade"></div>
        <section class="s1">
          <p class="label">Para refletir</p>
          <h1 class="display quote">Consciência é o começo,<br /><em>mas não é o fim.</em></h1>
          <p class="author">— Dr. Henry Cloud</p>
          <p class="sub1">Perceber o que dói é um passo corajoso.<br />Encontrar um espaço seguro para cuidar disso é o passo seguinte.</p>
          <img src="assets/tree-logo.png" alt="Lays Coelho Psicologia" class="s1-logo" />
          <p class="crp">Lays Coelho · Psicóloga Clínica · CRP 04/67406</p>
        </section>
      }
    </div>
  `,
  styles: [`
    :host { display:block; margin:0; }
    .frame {
      --sage:#4D6D66; --ink:#1C221F; --muted:#556661; --cream:#FDFBF7; --mint:#D4E6E1;
      position:relative; overflow:hidden; container-type:inline-size;
      width:100vw; aspect-ratio:9/16; background:var(--cream);
      font-family:'Plus Jakarta Sans', sans-serif; color:var(--ink);
    }
    .display { font-family:var(--font-display, 'Instrument Serif', Georgia, serif); font-weight:400; line-height:1.04; letter-spacing:-0.01em; margin:0; }
    .display em { font-style:italic; color:var(--sage); }
    .label { font-size:3.2cqw; letter-spacing:0.18em; text-transform:uppercase; color:var(--sage); font-weight:600; margin:0; }
    p { margin:0; }

    .blob { position:absolute; border-radius:50%; filter:blur(2cqw); }
    .b1 { width:90cqw; height:90cqw; top:-20cqw; right:-30cqw; background:radial-gradient(circle, rgba(212,230,225,.7), transparent 70%); }
    .b2 { width:80cqw; height:80cqw; bottom:-25cqw; left:-30cqw; background:radial-gradient(circle, rgba(77,109,102,.14), transparent 70%); }

    section { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; text-align:center; }

    /* ---------- Story 1 ---------- */
    .bg-photo { position:absolute; left:0; top:0; width:100%; height:50cqw; object-fit:cover; object-position:50% 30%; }
    .bg-fade { position:absolute; left:0; top:0; width:100%; height:50.5cqw;
               background:linear-gradient(to bottom, rgba(253,251,247,0) 0%, rgba(253,251,247,0) 35%, rgba(253,251,247,.85) 75%, var(--cream) 100%); }
    .s1 { padding:41cqw 8cqw 0; height:100%; box-sizing:border-box; }
    .quote { font-size:9.8cqw; margin-top:3.5cqw; }
    .author { font-size:3.6cqw; font-weight:600; letter-spacing:.04em; color:var(--sage); margin-top:3.5cqw; }
    .sub1 { font-size:3.8cqw; line-height:1.45; color:var(--muted); font-weight:500; margin-top:5cqw; }
    .s1-logo { width:18cqw; margin-top:8cqw; }
    .s1 .crp { position:absolute; left:0; right:0; bottom:8cqw; font-size:2.9cqw; color:#8F9C99; letter-spacing:.04em; }

    /* ---------- Story 3 ---------- */
    .s3 { padding-top:24cqw; display:flex; flex-direction:column; align-items:center; text-align:center; height:100%; box-sizing:border-box; }
    .s3-logo { width:22cqw; margin-bottom:5cqw; }
    .title3 { font-size:12.5cqw; line-height:1.05; }
    .url { font-size:5.5cqw; font-weight:600; color:var(--sage); letter-spacing:.02em; margin-top:5cqw; }
    .hint { font-size:3.8cqw; color:var(--muted); margin-top:6cqw; font-weight:400; }
    .arrow { width:7cqw; color:var(--sage); margin-top:3cqw; }
    .sticker-zone { width:100%; height:32cqw; }
    .s3 .crp { position:absolute; left:0; right:0; bottom:8cqw; font-size:2.9cqw; color:#8F9C99; letter-spacing:.04em; }
  `],
})
export class StoryImagesComponent {
  readonly n = Number(inject(ActivatedRoute).snapshot.paramMap.get('n')) === 3 ? 3 : 1;
}




