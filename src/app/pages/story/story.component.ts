import { Component, signal } from '@angular/core';

/**
 * Story animado (9:16) para Instagram — divulgação do site.
 * Duração: 15s. Grave a tela em /story (ou use o botão "Reiniciar") e publique como Story.
 * Todas as medidas usam `cqw` (1% da largura do quadro) para escalar em qualquer tela.
 */
@Component({
  selector: 'app-story',
  standalone: true,
  template: `
    <div class="stage" [class.rec]="recording">
      @if (playing()) {
        <div class="frame">

          <!-- Fundo: blobs suaves -->
          <div class="blob b1"></div>
          <div class="blob b2"></div>

          <!-- CENA 1 · Abertura (0–3s) -->
          <section class="scene s1">
            <img src="assets/tree-logo.png" alt="" class="s1-logo" />
            <p class="label">Novidade</p>
            <h1 class="display s1-title">Um novo espaço<br /><em>para cuidar de você</em></h1>
            <p class="s1-url">layspsi.com.br</p>
          </section>

          <!-- CENA 2 · O site + vantagens (3–8s) -->
          <section class="scene s2">
            <p class="label center">Conheça o site</p>
            <div class="phone p2">
              <div class="screen">
                <img src="assets/story/site-hero.jpg" alt="" class="shot shot-a" />
                <img src="assets/story/site-servicos.jpg" alt="" class="shot shot-b" />
              </div>
            </div>
            <ul class="chips">
              <li class="chip c1"><span class="dot"></span>100% online, de onde você estiver</li>
              <li class="chip c2"><span class="dot"></span>Individual · Familiar · Casal</li>
              <li class="chip c3"><span class="dot"></span>Sigilo ético e profissional</li>
            </ul>
          </section>

          <!-- CENA 3 · Como agendar (8–12.5s) -->
          <section class="scene s3">
            <h2 class="display s3-title">Agende online<br /><em>em 3 passos</em></h2>
            <div class="s3-body">
              <div class="phone p3">
                <div class="screen">
                  <img src="assets/story/site-agenda.jpg" alt="" class="shot" />
                  <span class="tap"></span>
                </div>
              </div>
              <ol class="steps">
                <li class="step st1"><b>1</b><span>Escolha o tipo de terapia</span></li>
                <li class="step st2"><b>2</b><span>Selecione data e horário</span></li>
                <li class="step st3"><b>3</b><span>Confirme pelo WhatsApp</span></li>
              </ol>
            </div>
          </section>

          <!-- CENA 4 · CTA (12.5–15s) — espaço inferior livre para a figurinha de link -->
          <section class="scene s4">
            <img src="assets/tree-logo.png" alt="" class="s4-logo" />
            <h2 class="display s4-title">O primeiro passo<br /><em>pode ser hoje</em></h2>
            <p class="s4-url">layspsi.com.br</p>
            <p class="s4-hint">Toque no link abaixo</p>
            <svg class="s4-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            <div class="sticker-zone"></div>
            <p class="s4-crp">Lays Coelho · Psicóloga Clínica · CRP 04/67406</p>
          </section>

          <!-- Barra de progresso -->
          <div class="progress"><span></span></div>
        </div>
      }

      @if (!recording) {
        <button type="button" class="replay" (click)="replay()">↻ Reiniciar</button>
      }
    </div>
  `,
  styles: [`
    :host { display:block; }
    .stage {
      min-height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:12px; background:#1C221F; padding:12px;
    }
    .frame {
      --sage:#4D6D66; --ink:#1C221F; --muted:#556661; --cream:#FDFBF7; --mint:#D4E6E1;
      position:relative; overflow:hidden; container-type:inline-size;
      width:min(100%, calc((100dvh - 70px) * 9 / 16)); aspect-ratio:9/16;
      background:var(--cream); border-radius:12px;
      font-family:'Plus Jakarta Sans', sans-serif; color:var(--ink);
    }
    .display { font-family:var(--font-display, 'Instrument Serif', Georgia, serif); font-weight:400; line-height:1.02; letter-spacing:-0.01em; }
    .display em { font-style:italic; color:var(--sage); }
    .label { font-size:3.2cqw; letter-spacing:0.18em; text-transform:uppercase; color:var(--sage); font-weight:600; }
    .center { text-align:center; }

    .blob { position:absolute; border-radius:50%; filter:blur(2cqw); animation:float 9s ease-in-out infinite alternate; }
    .b1 { width:90cqw; height:90cqw; top:-20cqw; right:-30cqw; background:radial-gradient(circle, rgba(212,230,225,.7), transparent 70%); }
    .b2 { width:80cqw; height:80cqw; bottom:-25cqw; left:-30cqw; background:radial-gradient(circle, rgba(77,109,102,.12), transparent 70%); animation-delay:-4s; }
    @keyframes float { to { transform:translate(4cqw, 6cqw) scale(1.08); } }

    .scene { position:absolute; inset:0; padding:12cqw 8cqw; display:flex; flex-direction:column; opacity:0; }

    /* ---------- Cena 1 ---------- */
    .s1 { justify-content:center; align-items:center; text-align:center; gap:4cqw; animation:sceneIn 3s linear 0s both; }
    .s1-logo { width:26cqw; animation:pop .9s cubic-bezier(.2,.9,.3,1.3) .1s both; }
    .s1 .label { animation:rise .7s ease .5s both; }
    .s1-title { font-size:12cqw; animation:rise .9s ease .7s both; }
    .s1-url { font-size:5cqw; font-weight:500; color:var(--muted); letter-spacing:.02em;
              overflow:hidden; white-space:nowrap; width:0; border-right:.5cqw solid var(--sage);
              animation:type 1s steps(14) 1.5s both, caret .6s step-end 1.5s 3; }
    @keyframes type { to { width:38cqw; } }
    @keyframes caret { 50% { border-color:transparent; } }

    /* ---------- Cena 2 ---------- */
    .s2 { align-items:center; justify-content:center; gap:4.5cqw; animation:sceneIn 5s linear 3s both; }
    .p2 { animation:phoneIn 1s cubic-bezier(.2,.8,.2,1) 3.1s both; }
    .shot-b { animation:fadeIn .8s ease 5.4s both; }
    .chips { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:2.4cqw; width:100%; }
    .chip { display:flex; align-items:center; gap:2.6cqw; background:#fff; border:1px solid rgba(76,100,91,.15);
            border-radius:99cqw; padding:3cqw 5cqw; font-size:3.9cqw; font-weight:500; color:var(--ink);
            box-shadow:0 1cqw 4cqw rgba(28,34,31,.06); }
    .dot { width:2.2cqw; height:2.2cqw; border-radius:50%; background:var(--sage); flex-shrink:0; }
    .c1 { animation:slideIn .6s ease 4.0s both; }
    .c2 { animation:slideIn .6s ease 4.6s both; }
    .c3 { animation:slideIn .6s ease 5.2s both; }

    /* Mockup de celular */
    .phone { background:var(--ink); border-radius:7cqw; padding:1.6cqw; box-shadow:0 4cqw 10cqw rgba(28,34,31,.25); }
    .screen { position:relative; overflow:hidden; border-radius:5.6cqw; aspect-ratio:390/844; background:#fff; }
    .shot { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top; }
    .p2 { width:44cqw; }

    /* ---------- Cena 3 ---------- */
    .s3 { justify-content:center; gap:8cqw; animation:sceneIn 4.5s linear 8s both; }
    .s3-title { font-size:11cqw; animation:rise .8s ease 8.1s both; }
    .s3-body { display:flex; align-items:center; gap:5cqw; }
    .p3 { width:44cqw; flex-shrink:0; animation:phoneIn .9s cubic-bezier(.2,.8,.2,1) 8.3s both; }
    .steps { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:5cqw; }
    .step { display:flex; flex-direction:column; gap:1.6cqw; font-size:3.8cqw; line-height:1.3; color:var(--muted); }
    .step b { width:9cqw; height:9cqw; border-radius:50%; display:grid; place-items:center; font-size:4cqw;
              background:#F0ECE5; color:var(--muted); font-weight:600; }
    .st1 { animation:rise .5s ease 9.0s both; } .st1 b { animation:activate .4s ease 9.3s both; }
    .st2 { animation:rise .5s ease 9.8s both; } .st2 b { animation:activate .4s ease 10.1s both; }
    .st3 { animation:rise .5s ease 10.6s both; } .st3 b { animation:activate .4s ease 10.9s both; }
    @keyframes activate { to { background:var(--sage); color:#fff; transform:scale(1.08); } }
    /* "Toque" simulado no card Individual e no botão */
    .tap { position:absolute; width:12cqw; height:12cqw; border-radius:50%; background:rgba(77,109,102,.35);
           border:.5cqw solid rgba(255,255,255,.9); left:40%; top:45%; opacity:0;
           animation:tap1 .7s ease 9.4s both, tap2 .9s ease 10.5s forwards; }
    @keyframes tap1 { 0%{opacity:0;transform:scale(.4)} 50%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1.4)} }
    @keyframes tap2 { 0%{opacity:0;top:90%;transform:scale(.4)} 50%{opacity:1;top:90%;transform:scale(1)} 100%{opacity:0;top:90%;transform:scale(1.4)} }

    /* ---------- Cena 4 ---------- */
    .s4 { align-items:center; text-align:center; padding-top:22cqw; gap:3.5cqw; animation:sceneEnd 2.5s linear 12.5s both; }
    .s4-logo { width:18cqw; animation:pop .8s cubic-bezier(.2,.9,.3,1.3) 12.6s both; }
    .s4-title { font-size:12cqw; animation:rise .8s ease 12.8s both; }
    .s4-url { font-size:5.5cqw; font-weight:600; color:var(--sage); animation:rise .7s ease 13.2s both; }
    .s4-hint { font-size:3.6cqw; color:var(--muted); margin-top:4cqw; animation:rise .6s ease 13.5s both; }
    .s4-arrow { width:8cqw; color:var(--sage); animation:rise .6s ease 13.6s both, bounce 1s ease-in-out 14s infinite; }
    .sticker-zone { flex:1; }
    .s4-crp { font-size:2.8cqw; color:#8F9C99; letter-spacing:.04em; animation:fadeIn .6s ease 13.8s both; }
    @keyframes bounce { 50% { transform:translateY(2cqw); } }

    /* ---------- Utilitários de animação ---------- */
    @keyframes sceneIn  { 0%{opacity:0} 6%{opacity:1} 92%{opacity:1} 100%{opacity:0} }
    @keyframes sceneEnd { 0%{opacity:0} 12%{opacity:1} 100%{opacity:1} }
    @keyframes rise   { from{opacity:0; transform:translateY(5cqw)} to{opacity:1; transform:none} }
    @keyframes pop    { from{opacity:0; transform:scale(.5)} to{opacity:1; transform:none} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideIn{ from{opacity:0; transform:translateX(-8cqw)} to{opacity:1; transform:none} }
    @keyframes phoneIn{ from{opacity:0; transform:translateY(25cqw) rotate(-4deg)} to{opacity:1; transform:none} }

    .progress { position:absolute; top:3cqw; left:4cqw; right:4cqw; height:.6cqw; border-radius:1cqw; background:rgba(28,34,31,.1); overflow:hidden; }
    .progress span { display:block; height:100%; background:var(--sage); transform-origin:left; animation:prog 15s linear both; }
    @keyframes prog { from{transform:scaleX(0)} to{transform:scaleX(1)} }

    .replay { color:#D4E6E1; background:transparent; border:1px solid rgba(212,230,225,.3); border-radius:99px;
              padding:6px 16px; font-size:13px; cursor:pointer; }

    /* Modo gravação (/story?rec=1): quadro 9:16 preenche toda a viewport, sem moldura */
    .stage.rec { padding:0; gap:0; min-height:100vh; background:#FDFBF7; }
    .stage.rec .frame { width:100vw; border-radius:0; }

    @media (prefers-reduced-motion: reduce) { .scene, .scene * { animation-duration:.01s !important; } }
  `],
})
export class StoryComponent {
  readonly playing = signal(true);

  /** ?rec=1 → modo captura de vídeo (sem botão e sem moldura) */
  readonly recording = new URLSearchParams(globalThis.location?.search ?? '').get('rec') === '1';

  /** Remove e recria o quadro para reiniciar todas as animações CSS do zero */
  replay() {
    this.playing.set(false);
    setTimeout(() => this.playing.set(true), 50);
  }
}
