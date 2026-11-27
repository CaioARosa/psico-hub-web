# BRIEF — Lays Coelho · Psicoterapia Sistêmica (Home `/`)

> Status: `Self-authored from existing brand, copy, and real assets` (explicit rebuild request of the live Home page of `psico-hub-web`).

## 1. Vibe & References
- **Vibe (4 words):** Calma, editorial, presente, sistêmica.
- **References (cross-medium):**
  1. Monocle / Kinfolk print feature spreads (asymmetric paper layouts, generous margins, quiet authority).
  2. Architectural line-work diagrams (delicate relational threads connecting nodes over paper and dark slate).
  3. A quiet sunlit therapy room at 9am (warm linen, sage foliage, unhurried conversation).

## 2. Scroll Journey (6 Chapters)
1. **Reconhecimento (Title Page):** Asymmetric editorial opening with Henry Cloud's quote, Lays's real portrait in a 3-plane dimensional frame, and immediate access to `Agendar sessão`.
2. **Presença & Método (Sobre Lays):** Hard cut to warm linen. Lays's story, PUC Minas & Terapia Sistêmica background, three clinical pillars, and verified clinical numbers (`5+` anos, `200+` acolhimentos, `100%` sigilo).
3. **Territórios de Cuidado (Para quem é):** Hard cut to warm paper. Horizontal scroll rail (`pan`) presenting the 6 areas of care as editorial spreads rather than a generic 3x2 card grid.
4. **O Olhar Sistêmico (PEAK — Como acontece a terapia):** Hard cut to deep forest-charcoal (`#1C221F`). Brief authored stillness at entry, followed by the pinned Systemic Constellation Peak where scrolling physically draws the invisible threads connecting patterns, relationships, and the 4 stages of therapy.
5. **Ressonância & Clareza (Depoimentos + Dúvidas):** Hard cut to warm linen. Asymmetric editorial testimonials followed by a compact, scannable FAQ accordion.
6. **Compromisso (Agendamento & Colofão):** Hard cut to warm paper for the full interactive 4-step booking chamber (`BookingService` + `ZardCalendarComponent`), resolving into a grounded deep-charcoal editorial colophon with WhatsApp, email, CRP, and social links.

## 3. Energy Curve
- **Ch 1 (Hero):** Grounded, poised, inviting.
- **Ch 2 (Sobre):** Intimate, human, steady.
- **Ch 3 (Territórios):** Expansive, lateral curiosity.
- **Ch 4 (O Olhar Sistêmico — PEAK):** Stillness at entry -> focused intensity as the systemic web illuminates.
- **Ch 5 (Depoimentos & FAQ):** Reassuring, calm, practical.
- **Ch 6 (Agendamento & Colofão):** Clear, warm, decisive resolution.

## 4. Feeling Curve & Engineered Peak

| Chapter | Emotion | What on screen causes it |
|---|---|---|
| 1. Reconhecimento | Acolhimento sereno | Asymmetric paper title page with 3-plane parallax portrait and subtle systemic overlay |
| 2. Presença & Método | Confiança humana | Editorial clip-path reveal of Lays's method + real clinical counters ticking once on entry |
| 3. Territórios de Cuidado | Identificação ampla | Lateral horizontal rail (`pan`) where each care territory enters like turning pages |
| 4. O Olhar Sistêmico | Clareza reveladora (PEAK) | Deep charcoal ground, authored pause, then pinned SVG systemic constellation drawing threads between patterns and the 4 therapy stages as you scroll |
| 5. Ressonância & Clareza | Alívio prático | Asymmetric human testimonials + compact staggered FAQ accordion |
| 6. Compromisso | Decisão tranquila | Live 4-step booking chamber + permanent resolved colophon with WhatsApp and CRP |

- **The Peak:** *"A página escurece para um verde-carvão calmo e, conforme você rola, os fios invisíveis entre padrões, família e escolhas vão se desenhando na tela até mostrar como a terapia funciona."* (Lives in Chapter 4: O Olhar Sistêmico, largest pinned visual transformation on the page.)
- **Tell-someone sentence:** *"É o site da psicóloga onde os fios invisíveis das relações vão se conectando num mapa sistêmico enquanto você rola a página, até chegar na agenda."*
- **Authored silence:** Top breathing band of Chapter 4 (`#1C221F`) before the constellation pins, giving contrast between the bright lateral rail and the dark reflective peak.

## 5. Signature Move
**Fio Sistêmico (Live Margin Folio + Scroll-Drawn Systemic Constellation):**
1. A slim fixed editorial folio rail on the right edge (desktop) that traces a fine vertical thread as you scroll, stamping each chapter and allowing direct jumps.
2. Inside Chapter 4, a bespoke interactive SVG Systemic Constellation driven by `--sc-p`: scattered relational nodes connect via `stroke-dashoffset` into a unified map around *Consciência*, and visitors can click any node to read Lays's systemic note for that stage.

## 6. Aesthetic Family
**Editorial** (warm paper `#FDFBF7`, linen `#F5F2ED`, deep forest-charcoal `#1C221F`, single sage accent `#4D6D66` with light-on-dark stop `#9AC2B8`, `Instrument Serif` + `Plus Jakarta Sans`).

## 7. Structure Fork
**Chaptered editorial** (`uniqueness.md §2.2`) — distinct chapters with hard ground cuts, asymmetric spreads, live margin folio, no continuous `drift`, no `scrub`, no `magnet`, no `spotlight`.

## 8. Existing Real Assets
- `public/assets/lays_coelho_profile3.jpeg` — Real editorial portrait of Lays Coelho.
- `public/assets/tree-logo.png` — Brand tree mark.
- Live Angular 22 + Tailwind CSS v4 + ZardUI components + `BookingService` (must be preserved 100%).

## Score Table & Fingerprint Gate
- **Registry check:** `scrollcraft/FINGERPRINTS.md` is currently empty (first build in this workspace — clears gate cleanly).
- **Device families used (6, zero consecutive repeats):** `parallax` (Ch 1) -> `reveal` + `count` (Ch 2) -> `pan` (Ch 3) -> `pin` + bespoke `--sc-p` SVG constellation (Ch 4) -> `flow` + `in` stagger (Ch 5) -> interactive booking surface + editorial colophon (Ch 6).
- **Single primary CTA label everywhere:** `Agendar sessão`.
