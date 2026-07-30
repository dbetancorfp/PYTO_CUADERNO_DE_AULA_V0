# Dashboard

Landing view right after a successful login (Login's UC-01 redirects here). It's the hub
every teacher lands on: a top navigation bar plus seven big entry points into the rest of
the cuaderno de aula, one per major area of the app. None of those seven destination views
exist yet — each is a large card/link that will navigate to its own view once built. This
description covers only the Dashboard itself (navbar, the seven cards/links, session/welcome
behavior) — not what's inside each destination, which will be its own view later.

Domain: Formación Profesional (Canary Islands). A teacher's cuaderno de aula here is
organized by **ciclo formativo** (training cycle) and **módulo profesional** (professional
module), not by grade level/subject.

## What the user sees

### Top navigation bar

A single bar across the top of the page:

- **Left end**: the app logo. The image asset is pending (the user will provide it later)
  — use a placeholder (e.g. the app name as text) until it's supplied.
- **Right end**, in this exact order:
  1. A **Configuración** link (`settings-menu`). Reopened after the Configuración view was
     built: it's now a real, always-enabled link to `/configuracion/profesor` (the Profesor
     screen — see `views/configuracion/description_configuracion.md`). No dropdown/menu of
     its own here; it's a plain navigation link, same as the seven cards below.
  2. Text **"Bienvenido, `<nombre del profesor>`"** — the signed-in teacher's full name,
     read from the session (see Login view's session work, added alongside this view).
  3. A **"Salir"** link/button — ends the session and returns the user to `/login`.

### Body — seven section cards

Below the navbar, a responsive grid of seven large cards, each a link into its own section.
Display order:

1. **Calendario** — días festivos, fechas de comienzo de temas, fechas de inicio y fin de
   proyectos, fechas de controles y exámenes finales, fechas de inicio y fin de la FEOE
   (Formación en Empresa u Organismo Equiparado) y otras fechas relevantes.
2. **Criterios de evaluación** — por ciclo formativo y módulo profesional.
3. **Unidades de Trabajo** — contenido de las unidades de trabajo; planificación de tareas y
   pruebas objetivas.
4. **Listado de alumnos** — por ciclo y módulo; notas de tareas, proyectos, controles y
   exámenes; cálculo de la nota final de cada evaluación.
5. **Diario** — dos columnas por sesión: lo planificado y, al lado, lo realmente sucedido,
   con espacio para notas o cambios de mejora.
6. **Vista individual de alumno** — notas, observaciones y faltas de asistencia.
7. **Informes** — imprimibles/exportables.

Each card is a big clickable link (icon + title). Clicking one navigates to that section's
own route — none of those routes are built yet, so for this view a click just needs to
navigate there; what happens once you land is out of scope here.

## Behavior

- The Dashboard is only reachable to a signed-in teacher. With no valid session (missing or
  invalid `session_id`), redirect to `/login` instead of showing the Dashboard.
- Clicking **Salir** ends the session server-side and redirects to `/login`. Afterwards, the
  Dashboard must not be reachable again via back button or a stale/resubmitted session
  cookie.
- Clicking **Configuración** navigates to `/configuracion/profesor` (see above — reopened,
  previously a disabled placeholder).
- Clicking any of the seven cards navigates to that card's route.

## Data

- Needs the signed-in teacher's full name — see Login view's session work (adds a
  `full_name` column to `users` and a way to ask "who is signed in").
- No other new data for this view: the seven cards don't query anything themselves (their
  own future views will).

## Out of scope

- The actual content of each of the seven sections (Calendario, Unidades de Trabajo, etc.)
  — separate views, one at a time.
- Configuración's own screens/behavior once navigated to — that's the Configuración view
  itself, already built.
- Multi-teacher/role differences (admin vs. teacher) beyond showing the signed-in teacher's
  name.
