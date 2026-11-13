# Dossier de Inteligencia de Dominio — Psicología clínica autónoma (Brasil)

Fecha: 2026-11-12 · Proyecto: `psico-hub-web` · Nicho: psicóloga clínica persona física (Lays Coelho, CRP 04/67406), atención 100% online, terapia sistémica (individual, de pareja y familiar).

> Aviso: no sustituye asesoría jurídica ni contable. Las fuentes consultadas (CFP, CRPs, Receita Federal, blogs de contabilidad) deben confirmarse con el CRP-04 y con un contador antes de decidir.

## 1. Cumplimiento y normativa

| Norma | Qué exige | Impacto en el proyecto |
| :-- | :-- | :-- |
| **Resolución CFP 09/2024** | Sustituyó a la 11/2018. El registro **e-Psi dejó de ser obligatorio** (plataforma desactivada el 31/08/2024). La psicóloga decide y responde por la viabilidad del atendimiento online. | El sitio no cita e-Psi (verificado con búsqueda en `src/`). Bien. Recomendado: documentar la evaluación de viabilidad online en el prontuario (fuera de este sistema). |
| **Resoluciones CFP 001/2009 y 006/2019 + Manual CFP (2025)** | Guarda mínima de **5 años** desde el último registro. Para niños y adolescentes se recomienda más tiempo (hasta la mayoría de edad y plazos civiles). | El sistema no debe permitir borrado definitivo de pacientes ni sesiones. Hoy usa `active` (correcto); mantenerlo así. |
| **LGPD (Ley 13.709/2018), arts. 5 II y 11** | Datos de salud son **sensibles**. Se necesita base legal, aviso de privacidad, minimización y seguridad. | Ver punto 2: "nada clínico" no equivale a "nada sensible". |
| **Receita Saúde** (obligatorio desde 01/01/2025 para psicólogos persona física) | Recibo electrónico **por cada pago recibido**, emitido por la profesional en la app de la Receita o en Carnê-Leão Web (e-CAC, gov.br nivel plata/oro). Sin él, el paciente no puede deducir. | Lo más valioso que el sistema puede hacer en la Fase 2. Hoy la spec lo deja fuera de alcance (§1). |
| **Carnê-leão** | Recaudación mensual del IR sobre lo recibido de personas físicas. | Reporte por **fecha de pago** (`paidAt`), no por `referenceMonth`. |
| **Código de Ética del Psicólogo (Res. CFP 010/2005)** | Secreto profesional (art. 9). | Acceso único ya garantizado por claim `admin`. |

Puntos que las fuentes consultadas mencionan y que debe confirmar el contador: nueva exención de IR hasta R$ 5 mil mensuales (vigente desde enero de 2026), y si hay obligación de nota fiscal según la situación (persona física vs. jurídica).

## 2. Hallazgo central: "no clínico" ≠ "no sensible"

La spec (§8) protege bien el contenido clínico, pero la lista `patients` (nombre + teléfono) ya revela que una persona está en psicoterapia, y `sessions` dice cuándo. Bajo la LGPD eso es dato de salud. Consecuencias concretas:

1. Se necesita **aviso de privacidad** y base legal registrada (tutela de la salud, art. 11, II, "f", o consentimiento).
2. El sitio público **no tiene política de privacidad ni casilla de consentimiento** (verificado en `home.html` y `home.component.ts`).
3. `POST /api/book` escribe en la descripción del evento de Google Agenda el e-mail y las "Notas/Quejas" (`server/server.js`, líneas ~174-180). Esa observación ya llega a Lays por WhatsApp, así que duplicarla en el Agenda amplía el acceso sin beneficio.
4. Se necesitan **copias de seguridad** y exportación de los datos (Firestore export programado), y definir cómo atender un pedido de eliminación frente a la guarda mínima de 5 años.
5. La cuenta única de Lays es el punto de falla: activar verificación en dos pasos en la cuenta de Google y en Firebase Auth (confirmar disponibilidad de MFA en el plan actual).

## 3. UX de nicho

- **Terapia de pareja y familia**: un paciente = un cobro no calza. Hay un pagador (a veces dos personas que dividen) y varios atendidos. Los títulos del Agenda pueden traer solo uno de los nombres (`Consulta [Casal] - Ana`), que no calzaría con un paciente llamado "Ana e João".
- **Vocabulario**: la psicóloga dice "paciente", "sessão", "falta", "reposição", "pacote". Mantener. Evitar jerga financiera ("inadimplente"); preferir "em aberto".
- **Cobrar con delicadeza**: la Fase 4 (WhatsApp con mensaje listo) debe tener tono acogedor y permitir editar el texto antes de enviar; el vínculo terapéutico es parte del producto.
- **Cancelación tardía**: es común en contratos terapéuticos (aviso de 24 h). La spec solo tiene `chargeNoShow` (falta). Considerar una regla para cancelación tardía.
- **Mobile primero**: Lays confirma sesiones entre pacientes; botones grandes (la UI ya usa `min-h-11`).

## 4. Puntos de dolor ocultos (proyectos similares)

1. Vínculo por nombre en el título falla cuando el título usa apodo o solo un nombre de la pareja. Solución: campo de **alias** por paciente.
2. Olvidarse de emitir el Receita Saúde en el mes y descubrirlo en la declaración anual.
3. Confundir mes de referencia con mes de pago al preparar el carnê-leão.
4. Datos de pacientes en el sitio público o en eventos del Agenda con más acceso del necesario.
5. Sin copia de seguridad: un error de escritura o de cuenta borra la historia financiera.

## 5. Stack de industria

El stack actual (Angular + Firebase + Cloud Run + Google Agenda) es adecuado para una profesional. No se recomienda cambiar. Mejoras puntuales: Firestore export programado, reglas con validación de tipos, `checkRevoked` en el backend y límite de tasa en rutas públicas.
