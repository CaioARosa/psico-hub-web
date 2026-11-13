# Backlog — Evolución de la Gestión del Consultorio

Fecha: 2026-11-12 · Base: `docs/diagnostico-andruia-2026-11-12.md` y `docs/andruia/dossier-inteligencia-nicho.md`

Prioridad: **P0** bloquea producción · **P1** antes de la Fase 2 · **P2** mejora. Estimaciones en tiempo de trabajo efectivo.

## P0 — Antes de poner en producción la Fase 1

- [x] **T1. Confirmar con Lays que el título del evento contiene el nombre del paciente.** Confirmado el 2026-11-12: el nombre aparece. T6 (alias) baja a mejora para pareja/familia.
- [x] **T2. Ejecutar `npm run test:rules` con JDK.** Hecho el 2026-11-12 con Temurin 21 portátil (4/4 en verde). Nota: en este Mac Intel con macOS 26, `brew install openjdk@17` compila desde fuente; para repetirlo, definir `JAVA_HOME` hacia un JDK 21 antes del comando.
- [x] **T3. Quitar "Notas/Quejas" y e-mail de la descripción del evento.** Hecho el 2026-11-12: `server/lib/booking-event.js` (+ 5 pruebas); la ruta `POST /api/book` lo usa. La descripción conserva nombre, teléfono y tipo de sesión. Pendiente: desplegar con `npm run deploy:backend`. Los eventos ya creados con queja siguen en el Agenda (limpieza manual).
- [ ] **T4. Aviso de privacidad y consentimiento en el formulario de reserva.** Página `/privacidade` (finalidad, base legal, datos, retención, contacto del encargado) y casilla obligatoria en `home.html`. Revisar el texto con asesoría jurídica. (3 h + revisión externa)
- [ ] **T5. Copia de seguridad.** Firestore export programado (Cloud Scheduler) o PITR; probar una restauración. (1 h)

## P1 — Antes de la Fase 2

- [ ] **T6. Campo `aliases: string[]` en pacientes.** `findPatientForEvent` (backend) debe considerar nombre y alias; formulario con lista de alias; pruebas para pareja/familia y apodo. (2 h)
- [ ] **T7. Modalidad y pagador en el paciente.** `modality: 'individual' | 'couple' | 'family'` y `payerName` opcional. Sin cambiar el cálculo de la Fase 1. (2 h)
- [ ] **T8. Endurecer el backend.** `verifyIdToken(token, true)` (`checkRevoked`); límite de tasa en `/api/availability` y `/api/book`; CORS restringido a los dominios del sitio. (1 h)
- [ ] **T9. Validar tipos en `firestore.rules`.** `amount` entero ≥ 0, `status` dentro del enum, `agreement.type` válido; agregar pruebas al emulador. (1.5 h)
- [ ] **T10. Corregir `planSessionSync`** para que una sesión sin paciente creada por cambio de mes reintente el vínculo (hoy solo lo reintenta en actualización). Prueba incluida. (1 h)

## P1 — Fase 2 (Financiero), con el nicho incorporado

- [ ] **T11. Registro de Pix con `receitaSaudeIssued: boolean`** y vista "Pagos sin recibo Receita Saúde". Recordatorio, no emisión automática (no se asumió API pública de emisión). (3 h)
- [ ] **T12. Reporte mensual por fecha de pago (`paidAt`)** para apoyar el carnê-leão, separado del resumen por `referenceMonth`. Exportar CSV. (2 h)
- [ ] **T13. Resumen del mes** (recibido, a recibir, en atraso) según spec §6. (4 h)

## P2 — Mejoras

- [ ] **T14. Regla de cancelación tardía** (`chargeLateCancel`) además de `chargeNoShow`. (2 h)
- [ ] **T15. Fase 4: mensaje de cobro editable y con tono acogedor** antes de abrir `wa.me`. (2 h)
- [ ] **T16. Documentación:** README (Render → Cloud Run, árbol de carpetas con `/admin`) y comentario "PENDING" de `firebase-config.ts`. (20 min)
- [ ] **T17. Skill de proyecto `@psico-compliance-br`** (ver `plan_implementacion.md`, sección 5), si el usuario lo aprueba. (1 h)

## Orden recomendado

T1 → T2 → T3 → T5 → T4 → T8 → T9 → T6 → T10 → T7 → Fase 2 (T11–T13) → T14–T16.
