# Revisión del módulo Financiero (Fase 2)

> **Actualización 2026-11-13:** la Fase 2 fue implementada en otro equipo (spec `docs/superpowers/specs/2026-11-13-gestao-fase-2-financeiro-design.md`, commits `4e81230`..`a4bf78d`). Verificado: backend 64/64, frontend 259/259, reglas 4/4, build OK.
>
> | Hallazgo | Estado |
> | :-- | :-- |
> | F1 paquete reescribe el pasado | **Resuelto** de otra forma: `packageAmountApplied` congelado en cada sesión. La opción A (historial) y la tarea F2-0 quedan **descartadas**. |
> | F2 `paidAt` con fuso | **Resuelto**: texto `YYYY-MM-DD`. |
> | F3 valor congelado al sincronizar | **Resuelto**: reajuste de sesiones `scheduled` al guardar el paciente. |
> | F4 valor manual por sesión | Abierto (fuera del alcance de la Fase 2). |
> | F5 atraso vs. crédito entre meses | **Resuelto**: abatimiento por crédito del más antiguo al más nuevo, con explicación en la tela. |
> | F6 / Receita Saúde | Abierto: no hay marca de recibo emitido. |
> | Reporte por fecha de pago (carnê-leão) | Abierto. |
>
> El resto de este documento es la revisión previa a la implementación.

Fecha: 2026-11-12 · Base: spec §4 y §6, código de la Fase 1, `dossier-inteligencia-nicho.md`

## 1. Estado

La Fase 2 **no está iniciada**: no hay colección `payments`, ni modelo, ni pantalla en `src/`. Existe solo la spec. Esta revisión valida las reglas de cálculo (§6) antes de escribir código.

Lo que la Fase 1 ya aporta a la Fase 2: `Session.amountApplied` congelado al crear la sesión (por sesión), `monthWindow`/`currentMonth` en UTC-3, `parseBRLToCents`/`formatCents`, y estados de sesión confirmados por Lays.

## 2. Hallazgos

| # | Severidad | Hallazgo | Corrección propuesta |
| :-- | :-- | :-- | :-- |
| F1 | **Alta** | **El paquete mensual reescribe el pasado.** §6 dice "Devido (paquete) = `agreement.amount` del paciente". Pero `PatientsService.update` sobrescribe `agreement` en el mismo documento. Si Lays sube el paquete de R$ 600 a R$ 700 en diciembre, noviembre pasa a deber R$ 700 y el "en atraso" cambia solo. Por sesión no ocurre porque `amountApplied` está congelado. | Congelar también el valor del paquete por mes (ver opciones en §3). |
| F2 | **Alta** | **`paidAt` como "date"** (§4) puede guardarse como `Timestamp` en UTC y correrse un día en BRT (pago el 31/10 a las 22:00 pasa a noviembre). Rompe el reporte de carnê-leão, que depende del mes del pago. | Guardar `paidAt` como texto `YYYY-MM-DD` (fecha civil de Brasil), sin hora. |
| F3 | Media | **Valor de la sesión se congela al sincronizar, no al confirmar.** Si Lays sincroniza el mes el día 1 y cambia el precio el día 10, las sesiones aún no realizadas conservan el precio viejo. | Re-fijar `amountApplied` al marcar `done`/`no_show`, a menos que haya valor manual (F4). |
| F4 | Media | **No hay forma de cortesía, primera sesión distinta o descuento puntual.** Fase 1 lo deja explícitamente sin edición manual del valor. | Permitir editar `amountApplied` de una sesión (con marca `amountOverridden: true` para que F3 no lo pise). |
| F5 | Media | **"En atraso" por mes, sin compensar entre meses.** Un Pix registrado con el mes equivocado produce atraso en un mes y crédito en otro, ambos visibles. | Mostrar por paciente el **saldo total** (Σ debido − Σ recibido) como cifra principal y el detalle por mes debajo. Sugerir como `referenceMonth` por defecto el mes abierto más antiguo. |
| F6 | Media | **Un Pix que cubre varios meses** exige varios registros, pero la profesional emite **un** recibo Receita Saúde por pago (documentado por la Receita). | Un registro por mes, con la bandera de recibo editable en grupo (marcar todos los registros del mismo Pix). Sin modelo nuevo por ahora. |
| F7 | Baja | **"Previsto" no está definido para paquete.** | Previsto del paquete = `agreement.amount`. |
| F8 | Baja | **Lectura de todo el historial para "en atraso".** Cada apertura lee las sesiones y pagos de todos los meses anteriores. Con ~40 pacientes × 4 sesiones × 12 meses ≈ 1.900 documentos al año: dentro del plan gratuito (50.000 lecturas/día), pero crece. | Aceptable al inicio. Reevaluar tras ~3 años o guardar resúmenes de meses cerrados. |

Reglas de §6 que se confirman sin cambios: `cancelled` nunca genera valor, `chargeNoShow` solo suma faltas, el excedente de un paquete alerta pero no cambia el valor, y el "recibido" suma por `referenceMonth`.

## 3. Decisión pendiente: cómo congelar el paquete (F1)

| Opción | Cómo funciona | A favor | En contra |
| :-- | :-- | :-- | :-- |
| **A. Historial en el paciente** | `agreementHistory: [{ from: 'YYYY-MM', ...acuerdo }]`; el valor de un mes es la última entrada con `from ≤ mes`. El formulario pregunta "válido desde qué mes". | Sin escrituras extra; el pasado nunca cambia; sirve también para cambios de frecuencia. | Toca la Fase 1 (formulario y documento del paciente). |
| **B. Cargo mensual** | Colección `charges/{patientId}_{YYYY-MM}` con el valor a cobrar, creada al confirmar el mes. | Cada mes queda explícito y editable (descuento puntual). | Paso nuevo para Lays cada mes; mes sin confirmar sin deuda. |
| **C. Aceptar el riesgo** | Sin cambios. | Cero trabajo. | F1 queda abierto: el historial cambia silenciosamente. |

Recomendación: **A**. Es el único que no agrega trabajo mensual a Lays y protege el pasado.

**Decisión (2026-11-13): opción A aprobada por el usuario.** Implica una tarea previa a F2-1:

- **F2-0 Historial de acuerdos** (3 h): `agreementHistory: Array<{ from: 'YYYY-MM' } & Agreement>` en `patients`; función pura `agreementForMonth(patient, month)`; migración en lectura (documento sin historial → una entrada con `from` = mes más antiguo); el formulario pregunta "válido desde" (por defecto, mes actual) al cambiar el acuerdo. `agreement` se mantiene como el vigente para no romper la sincronización del backend.

## 4. Cambios propuestos a la spec

- §4 `payments.paidAt`: texto `YYYY-MM-DD`. Agregar `receitaSaudeIssued: boolean` (por defecto `false`).
- §4 `sessions`: agregar `amountOverridden: boolean` (por defecto `false`).
- §4 `patients`: agregar `agreementHistory` (si se aprueba la opción A).
- §6: definir "Previsto" del paquete; añadir "Saldo total del paciente".
- §1 "Fuera de alcance": cambiar "Emisión de recibo" por "Emisión automática de recibo" y añadir "Seguimiento de recibos Receita Saúde" como funcionalidad.
- Sin almacenar CPF del pagador: la emisión ocurre en la app de la Receita; el sistema solo recuerda cuáles pagos aún no tienen recibo.

## 5. Tareas de la Fase 2 (reemplazan T11–T13)

1. **F2-1 Dominio de cálculo** (puro, con pruebas): `dueForMonth`, `receivedForMonth`, `balances`, `overdue`, `forecast`, `frequencyAlert`. Casos: pacote con exceso, `chargeNoShow`, cancelada, crédito, virada de mês, cambio de acuerdo (F1). (4 h)
2. **F2-2 Modelo y servicio de pagos**: `payments` con `paidAt` civil, `receitaSaudeIssued`; reglas del Firestore con validación de tipos y pruebas en emulador. (3 h)
3. **F2-3 Pantalla Pagos**: formulario de Pix (mes de referencia sugerido, F5) e historial con filtro "sin recibo". (4 h)
4. **F2-4 Pantalla Resumen del mes**: tarjetas Recibido / A recibir / En atraso y tabla por paciente con saldo total. (4 h)
5. **F2-5 Reporte por fecha de pago**: total recibido por mes de `paidAt` y CSV, como apoyo del carnê-leão (validar con el contador). (2 h)
6. **F2-6 Valor manual de sesión** (F3, F4): editar `amountApplied`, marca `amountOverridden`, re-fijar al confirmar. (3 h)

Orden: F2-0 → F2-1 → F2-2 → F2-3 → F2-4 → F2-6 → F2-5.

## 6. Verificación antes de entregar

`cd server && npm test`, `npx ng test --watch=false`, `npm run test:rules` (con JDK), `npm run build`.
