import { Component, computed, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SafeHtmlPipe } from '@/shared/pipes/safe-html.pipe';

interface BioLink {
  title: string;
  subtitle?: string;
  /** Link externo (WhatsApp, etc.) */
  url?: string;
  /** Rota interna do Angular + âncora opcional (ex.: route '/', fragment 'sobre') */
  route?: string;
  fragment?: string;
  isPrimary?: boolean;
  badge?: string;
  iconSvg: string;
}

@Component({
  selector: 'app-links',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, RouterLink, SafeHtmlPipe],
  template: `
    <main class="min-h-[100dvh] flex flex-col justify-between py-10 px-5 sm:px-8 relative overflow-hidden"
          style="background-color: #FDFBF7;">

      <!-- Elementos sutis de fundo -->
      <div class="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div class="blob" style="
          width:360px; height:360px;
          top:-5%; right:-10%;
          background:radial-gradient(circle,rgba(212,230,225,0.5) 0%,transparent 70%);
          --blob-duration:14s; --blob-delay:0s;">
        </div>
        <div class="blob" style="
          width:320px; height:320px;
          bottom:5%; left:-10%;
          background:radial-gradient(circle,rgba(77,109,102,0.08) 0%,transparent 70%);
          --blob-duration:12s; --blob-delay:2s;">
        </div>
      </div>

      <!-- Container Central -->
      <div class="w-full max-w-md mx-auto relative z-10 flex-1 flex flex-col items-center">

        <!-- Header / Perfil -->
        <header class="flex flex-col items-center text-center mb-8">
          <div class="relative mb-4">
            <div class="w-24 h-24 rounded-full p-1 border border-[#4D6D66]/25 shadow-sm overflow-hidden bg-white">
              <img src="assets/lays_coelho_profile3.jpeg"
                   alt="Lays Coelho"
                   class="w-full h-full object-cover rounded-full select-none" />
            </div>
            <!-- Ícone distintivo da marca -->
            <div class="absolute -bottom-1 -right-1 w-7 h-7 bg-[#4D6D66] rounded-full flex items-center justify-center shadow-md p-1.5"
                 title="Abordagem Sistêmica">
              <img src="assets/tree-logo.png" alt="" class="w-full h-full object-contain brightness-0 invert" />
            </div>
          </div>

          <h1 class="font-display text-2xl text-[#1C221F] tracking-tight">Lays Coelho</h1>
          <p class="text-xs uppercase tracking-[0.14em] text-[#4D6D66] font-semibold mt-1">
            Psicóloga Clínica · CRP 04/67406
          </p>
          <p class="text-sm text-[#556661] font-light max-w-xs mt-2 leading-relaxed">
            Abordagem Sistêmica · Terapia Individual, Familiar e de Casal · 100% Online
          </p>
        </header>

        <!-- Lista de Links -->
        <nav aria-label="Links rápidos" class="w-full space-y-3.5 mb-10">
          @for (link of links(); track link.title) {
            @if (link.route) {
              <a [routerLink]="link.route" [fragment]="link.fragment"
                 class="group w-full min-h-[58px] px-5 py-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all duration-200 active:scale-[0.98]"
                 [ngClass]="link.isPrimary ? primaryClass : secondaryClass">
                <ng-container *ngTemplateOutlet="linkContent; context: { $implicit: link }" />
              </a>
            } @else {
              <a [href]="link.url" target="_blank" rel="noopener noreferrer"
                 class="group w-full min-h-[58px] px-5 py-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all duration-200 active:scale-[0.98]"
                 [ngClass]="link.isPrimary ? primaryClass : secondaryClass">
                <ng-container *ngTemplateOutlet="linkContent; context: { $implicit: link }" />
              </a>
            }
          }
        </nav>

        <!-- Conteúdo compartilhado do botão (interno ou externo) -->
        <ng-template #linkContent let-link>
              <div class="flex items-center gap-3.5 min-w-0">
                <span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 [&>svg]:w-4 [&>svg]:h-4"
                      [ngClass]="link.isPrimary ? 'bg-white/15 text-white' : 'bg-[#D4E6E1]/50 text-[#4D6D66]'"
                      [innerHTML]="link.iconSvg | safeHtml">
                </span>
                <div class="text-left min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-[0.925rem] leading-snug"
                          [ngClass]="link.isPrimary ? 'text-white' : 'text-[#1C221F]'">
                      {{ link.title }}
                    </span>
                    @if (link.badge) {
                      <span class="text-[0.625rem] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                            [ngClass]="link.isPrimary ? 'bg-[#D4E6E1] text-[#1C221F]' : 'bg-[#4D6D66]/10 text-[#4D6D66]'">
                        {{ link.badge }}
                      </span>
                    }
                  </div>
                  @if (link.subtitle) {
                    <p class="text-xs font-light mt-0.5 line-clamp-2"
                       [ngClass]="link.isPrimary ? 'text-white/80' : 'text-[#8F9C99]'">
                      {{ link.subtitle }}
                    </p>
                  }
                </div>
              </div>

              <!-- Seta indicadora -->
              <svg class="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                   [ngClass]="link.isPrimary ? 'text-white/70' : 'text-[#8F9C99]'"
                   fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
        </ng-template>

        <!-- Redes e Contato Rápido -->
        <div class="flex items-center justify-center gap-3 text-xs text-[#556661] mb-6">
          <a href="https://www.instagram.com/lays.psi/" target="_blank" rel="noopener noreferrer"
             class="p-2.5 rounded-full bg-white border border-[#4C645B]/15 text-[#4D6D66] hover:bg-[#D4E6E1]/30 transition-colors"
             aria-label="Instagram da Lays">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </a>
          <a href="https://www.linkedin.com/in/laysstephaniemarinhocoelho/" target="_blank" rel="noopener noreferrer"
             class="p-2.5 rounded-full bg-white border border-[#4C645B]/15 text-[#4D6D66] hover:bg-[#D4E6E1]/30 transition-colors"
             aria-label="LinkedIn da Lays">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
          </a>
          <a href="mailto:laysstephanie50@gmail.com"
             class="p-2.5 rounded-full bg-white border border-[#4C645B]/15 text-[#4D6D66] hover:bg-[#D4E6E1]/30 transition-colors"
             aria-label="E-mail da Lays">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        </div>

      </div>

      <!-- Rodapé discreto -->
      <footer class="w-full text-center text-[0.7rem] text-[#8F9C99] relative z-10 pt-4 border-t border-[#4C645B]/10">
        <p>© {{ currentYear() }} Lays Coelho · layspsi.com.br</p>
      </footer>

    </main>
  `
})
export class LinksComponent {
  readonly currentYear = computed(() => new Date().getFullYear());

  readonly primaryClass   = 'bg-[#4D6D66] text-white shadow-md hover:bg-[#3f5a54] hover:shadow-lg border border-[#3f5a54]';
  readonly secondaryClass = 'bg-white text-[#1C221F] border border-[#4C645B]/15 hover:border-[#4D6D66]/40 hover:bg-[#F9F7F3] shadow-sm';

  readonly links = signal<BioLink[]>([
    {
      title: 'Agendar pelo WhatsApp',
      subtitle: 'Atendimento online em todo o Brasil',
      url: 'https://wa.me/553194720801?text=Ol%C3%A1%2C%20Lays!%20Vim%20pelo%20seu%20Instagram%20e%20gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20as%20sess%C3%B5es%20de%20terapia.',
      isPrimary: true,
      badge: 'Direto',
      iconSvg: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`
    },
    {
      title: 'Conhecer o Site Oficial',
      subtitle: 'layspsi.com.br',
      route: '/',
      badge: 'Novo',
      iconSvg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
    },
    {
      title: 'Abordagem Sistêmica',
      subtitle: 'Seus vínculos e sua história',
      route: '/',
      fragment: 'sobre',
      iconSvg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`
    },
    {
      title: 'Modalidades de Terapia',
      subtitle: 'Individual, familiar e de casal',
      route: '/',
      fragment: 'servicos',
      iconSvg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    }
  ]);
}
