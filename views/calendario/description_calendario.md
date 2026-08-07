# Calendario (dashboard)

## Qué es

Vista de solo lectura, accesible desde el dashboard (`calendar-card`, ya wired a
`/calendario` en `src/frontend/src/dashboard-view.ts:22`, sin ruta implementada
todavía), que muestra el calendario escolar (septiembre del año seleccionado a junio del
siguiente) de un módulo concreto que imparte el profesor autenticado, con los días clave
del curso marcados en color.

## Por qué una tabla nueva (`calendario_modulo`) y no leer `key_dates` directamente

`key_dates` (vista Fechas señaladas, Configuración) es una **plantilla global**,
día/mes sin año, sin relación con módulos ni años académicos — no permite fijar en qué
año calendario cae "22/12" (¿este diciembre o el que viene?) ni persiste si alguien edita
`key_dates` más adelante (una fecha borrada en Fechas señaladas no debería desordenar el
calendario de un módulo ya guardado).

Por eso: al guardar la selección de módulos de un año académico (vista Año académico,
botón "Guardar selección" — tanto al crear un año nuevo como al ampliarlo con más
módulos), se copian y resuelven a fechas reales las 6 categorías completas de
`key_dates` (43 filas) para cada módulo recién asignado, y se guardan en
`calendario_modulo`. La vista Calendario lee siempre de `calendario_modulo`, nunca de
`key_dates`.

## Ciclo de vida de `calendario_modulo`

- Se puebla en `POST /api/academic-years/selection` (creación de año académico con
  módulos) y en `POST /api/academic-years/:id/modules` (ampliación de un año académico
  ya existente con más módulos) — mismo efecto colateral en ambos flujos, ya que ambos
  terminan insertando filas nuevas en `academic_year_modules`.
- Se borra automáticamente (`ON DELETE CASCADE` desde `academic_year_modules`) cuando se
  elimina la asignación de un módulo a un año académico (`DELETE
  /api/academic-year-modules/:id`) — sin código de aplicación adicional, la base de
  datos lo garantiza.
- Idempotente: volver a guardar una selección que ya tenía calendario generado no
  duplica filas (`ON CONFLICT DO NOTHING` sobre la clave natural).

## Resolución de fecha real

`key_dates` guarda `start_day`/`start_month`/`end_day`/`end_month` (sin año).
Para un año académico con `start_year = Y` (curso Y–Y+1, septiembre Y a junio Y+1):
mes ≥ 9 (septiembre–diciembre) → año `Y`; mes ≤ 8 (enero–agosto) → año `Y+1`.

Ejemplo: año académico 2026, "Vacaciones de Navidad" (22/12–07/01) → `2026-12-22` a
`2027-01-07`.

## Datos que se copian

Las 6 categorías completas de `key_dates`, sin excepción ni filtrado por módulo (el
dato fuente no distingue por módulo):
`academic_key_dates`, `holidays`, `public_holidays`, `free_disposal_days`,
`evaluations`, `feoe_project_days`.

## Estructura de la vista Calendario

### Barra de navegación

Mismo estilo visual que las barras ya usadas (`classesFor('card')`, layout tipo
`dashboard-view.ts`'s `<nav>`): "Calendario" al extremo izquierdo, enlace "Volver" al
extremo derecho (navega a `/dashboard`). Vista de un único uso — no comparte la barra
con otras pantallas hermanas como sí hace Configuración.

### Filtros (3, dispuestos en horizontal, cada cambio actualiza el siguiente)

1. **Año (carrusel simulado con flechas ‹/›)**. Por defecto, el año escolar actual,
   calculado (no el campo `isCurrent` de `academic_years`, que es un flag manual): mes
   actual ≥ 9 → año natural actual; si no, año natural actual − 1.
   - Hacia atrás: solo años con fila real en `GET /api/academic-years` y
     `startYear < año actual calculado` (años que el profesor realmente ha impartido).
   - Hacia adelante: sin restricción de datos — desde el año actual hasta
     año actual + 5, aunque el profesor no tenga todavía ese año académico creado (en
     ese caso los filtros de ciclo/módulo quedan vacíos y el calendario muestra un
     estado vacío).
2. **Ciclo**. Ciclos que imparte el profesor autenticado en el año seleccionado —
   derivados de `GET /api/academic-years/:id/modules` (ya existe), igual que hace
   `academic-year-settings-view.ts` para `training-cycle-table`.
3. **Módulo**. Módulos del ciclo seleccionado, mismo origen de datos, filtrado
   client-side.

### Calendario

Al quedar seleccionado un módulo concreto (con su `academic_year_module_id`), se piden
sus filas de `calendario_modulo` (`GET
/api/calendario-modulo?academicYearModuleId=...`) y se muestran **solo los meses
escolares** (septiembre del año seleccionado a junio del siguiente, 10 meses).

- Es un Web Component (`app-calendario-view`) que compone 10 Cards (también Web
  Component o subcomponente), una por mes — un solo Shadow DOM real por regla del
  proyecto (ver CLAUDE.md "Frontend: Web Components" — nada de Shadow DOM anidado; los
  meses son elementos planos dentro del único Shadow DOM de `app-calendario-view`, no
  custom elements propios).
- Semana empieza en lunes (convención española).
- Colores: rojo — `academic_key_dates`, `holidays`, `public_holidays`,
  `free_disposal_days`. Azul — `evaluations`, `feoe_project_days`.
- **Rangos largos**: `calendario_modulo` guarda cada entrada como un rango
  (`start_date`/`end_date`), nunca una fila por día. Al pintar: rangos de ≤30 días se
  colorean día a día completos; rangos de >30 días (los tres de `academic_key_dates`
  que cubren casi todo el curso — "Curso escolar", "1º de Grado Superior", "2º de Grado
  Superior") solo colorean su día de inicio y su día de fin, para que el color siga
  teniendo significado visual en vez de teñir casi todo el calendario de rojo.
- Si varias categorías caen el mismo día, la celda reparte el color en franjas (CSS
  `linear-gradient` con paradas duras) — sin caso especial para 2 vs 3 categorías
  simultáneas.
- El número del día es lo único que se ve en la celda (compacta). Al pasar el ratón
  por encima de un día marcado, un Toast emergente (reutiliza `ToastController`/
  `renderToast` de `toast.ts`, nueva variante `'info'`) muestra el/los nombre(s)
  completo(s) del evento — se cierra al quitar el ratón (`dismiss()`), no espera al
  auto-dismiss de 5s.

## Fuera de alcance

- Ningún CRUD sobre `calendario_modulo` desde esta vista — es de solo lectura, generada
  por el efecto colateral de Año académico.
- No hay eventos propios de un módulo distintos de los de `key_dates` — hoy en día el
  contenido es idéntico para cualquier módulo del mismo año académico; el modelo queda
  preparado para diferenciarlos en el futuro sin cambiar de forma.
