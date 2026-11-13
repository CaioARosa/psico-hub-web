# Plan de Implementación — Evolución (Escenario B: proyecto existente)

Fecha: 2026-11-12 · Proyecto: `psico-hub-web`

## 1. Prescripción técnica

**Qué mejorar:** pasar la Fase 1 de "funciona y está probada" a "lista para producción con datos sensibles", y ajustar la Fase 2 a la realidad fiscal y clínica de una psicóloga autónoma.

**Mayor punto de dolor:** Lays no tiene control sistematizado de sesiones y cobros (spec §1). El riesgo mayor ahora es de privacidad y de premisas sin validar, no de lógica.

**Estándar de calidad objetivo:** cumplimiento LGPD para dato de salud, reglas de acceso probadas en emulador, copia de seguridad restaurable y reporte alineado con Receita Saúde y carnê-leão.

Supuestos declarados (a corregir si no aplican): atención como persona física; Lays es la única usuaria; el volumen se mantiene en decenas de pacientes.

## 2. Estado verificado

| Verificación | Resultado |
| :-- | :-- |
| `cd server && npm test` | 51/51 |
| `npx ng test --watch=false` | 98/98 (tras `npm install`) |
| `npm run test:rules` | No ejecutable: falta Java |
| Premisa "nombre en el título del evento" | Sin confirmar |

## 3. Hoja de ruta

### Etapa A — Desbloquear producción (≈ 5 h, más revisión jurídica)
1. T1: confirmar títulos con Lays.
2. T2: JDK 17 y `npm run test:rules`.
3. T3: limpiar la descripción del evento en `/api/book`.
4. T5: copia de seguridad y prueba de restauración.
5. T4: aviso de privacidad y consentimiento (texto revisado por un profesional del derecho).

Criterio de salida: reglas probadas en verde; ningún texto libre del paciente en el Agenda; página `/privacidade` publicada; restauración probada una vez.

### Etapa B — Endurecer y mejorar el vínculo (≈ 9 h)
T8 (backend), T9 (reglas con tipos), T6 (alias), T10 (reintento de vínculo), T7 (modalidad y pagador).

Criterio de salida: `npm test` (servidor), `npx ng test --watch=false` y `npm run test:rules` en verde; pruebas nuevas para alias, pareja/familia y reintento de vínculo.

### Etapa C — Fase 2 con el nicho incorporado (≈ 9 h)
T11 (Pix + bandera Receita Saúde), T12 (reporte por `paidAt`), T13 (resumen del mes).

Cambio de spec a aprobar: §1 "Fuera de alcance" deja de excluir por completo el recibo; se incluye el **seguimiento** de recibos (no la emisión).

### Etapa D — Fases 3 y 4 y mejoras (por demanda)
T14, T15, T16.

## 4. Riesgos

| Riesgo | Mitigación |
| :-- | :-- |
| Los títulos del Agenda no traen el nombre completo | Alias (T6) y bandeja "No identificados" ya existente |
| Normativa fiscal cambia | Contador valida el reporte; sin cálculos de impuesto en el sistema |
| Solicitud de eliminación de datos vs. guarda de 5 años | Procedimiento escrito; inactivar en lugar de borrar; consultar al CRP |
| Pérdida o acceso indebido a la cuenta única | Verificación en dos pasos, copia de seguridad, `checkRevoked` |

## 5. Squad y skill propuesta (Skill-Smith, Fase 1: ADN)

Squad: `@security-auditor`, `@legal-advisor`, `@test-automator`, `@ui-ux-pro-max`.

Propuesta de skill de proyecto (no creada; requiere aprobación del usuario):

1. **Nombre técnico:** `@psico-compliance-br`
2. **Rol experto:** auditora de cumplimiento para software de consultorio de psicología en Brasil (LGPD, CFP, Receita Saúde).
3. **Outputs clave:** lista de verificación por cambio (¿guarda dato sensible?, ¿hay borrado definitivo?, ¿hay texto libre del paciente en terceros?); reporte de brechas en `docs/`; revisión de PRs que toquen `patients`, `sessions`, `payments` o `server.js`.

## 6. Validación previa a cada entrega

1. `cd server && npm test`
2. `npx ng test --watch=false`
3. `npm run test:rules`
4. `npm run build`
