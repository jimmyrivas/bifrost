[← Índice de la guía](README.md)

# Automatización

Bifrost automatiza las partes repetitivas del trabajo remoto: comandos guardados que disparas desde un menú, runbooks en Markdown ejecutados paso a paso, scripts aislados que manejan el terminal, una biblioteca de snippets y hooks que corren cuando una conexión se abre o se cierra. Todo lo de abajo se alcanza desde dos sitios: la **barra lateral** (Scripts, Remote Cmds, Runbooks) para editar, y el submenú **Automation ▸** del clic derecho del terminal para ejecutar.

## El menú Automation

Clic derecho en cualquier terminal ▸ **Automation** para llegar a:

- **Scripts** — ejecutar un script guardado contra este terminal
- **Remote Commands** — disparar un comando guardado (agrupado, con confirmación donde esté marcada)
- **Runbooks** — ejecutar un runbook guardado contra esta pestaña
- **Explain Command** — explicación por IA del texto seleccionado
- **AI Assistant** (Ctrl+Shift+A)
- **Broadcast** — ciclar el modo de difusión de entrada (Off / Panes / All)
- **Paste Image to Server** (Ctrl+Shift+I) — ver [SFTP y archivos](06-sftp-files.md)
- **Enable cwd tracking** — integración de shell para enlaces `.md` relativos

Los submenús Scripts / Remote Commands / Runbooks están siempre presentes; mientras no hayas guardado ninguno, muestran una pista indicando la vista donde se crean.

## Comandos remotos

Un comando remoto es un comando de shell guardado que puedes enviar a cualquier sesión sin reescribirlo. Gestiónalos en la barra lateral, en **Remote Cmds**.

Cada comando tiene:

| Campo | Propósito |
|---|---|
| Comando | El texto enviado al terminal; admite tokens `<VAR>` y placeholders `{{param}}` |
| Descripción | La etiqueta mostrada en el menú |
| Grupo | Los comandos con el mismo grupo aparecen en su propio submenú |
| Ámbito | **Global** (todas las conexiones) o una conexión concreta |
| Confirmar | Preguntar antes de ejecutar |
| Atajo | Una etiqueta de atajo mostrada junto al comando en el menú |

Ejecútalos desde clic derecho ▸ **Automation ▸ Remote Commands**. Al ejecutar:

1. Si **Confirmar** está marcado, primero aparece un diálogo de confirmación.
2. Los tokens `<VAR>` (`<IP>`, `<USER>`, …) se expanden para la conexión actual — ver [Expansión de variables](#expansión-de-variables) más abajo.
3. Cada placeholder `{{param}}` te pide un valor; cancelar cualquier prompt aborta el comando.
4. El comando se escribe en la sesión (con un Enter final salvo que se configure lo contrario).

## Runbooks

Un runbook es un documento Markdown cuyos bloques de código cercados se convierten en pasos ejecutables. Abre **Runbooks** en la barra lateral para crear uno: pega (o escribe) el Markdown, guárdalo, y ejecútalo desde el editor o desde clic derecho ▸ **Automation ▸ Runbooks** en el terminal de destino.

En el editor tienes:

- Un selector de **pestaña destino** — elige qué sesión abierta recibe los comandos (por defecto, la pestaña activa).
- **Run this block** por paso, o **Run All** para recorrer el runbook completo.
- Estado por paso a medida que los bloques se ejecutan.
- Modo **dry-run** — los pasos se muestran con echo en el terminal en lugar de ejecutarse, para ensayar un procedimiento con seguridad.
- **Avisos de comandos peligrosos** — los bloques con patrones destructivos (p. ej. `rm -rf`, comandos que borran discos) se marcan, y debes confirmar explícitamente antes de que corran.

El editor incluye runbooks de ejemplo (chequeo de estado del servidor, mantenimiento Linux) que puedes copiar y adaptar.

## Scripts

Los scripts son automatizaciones en JavaScript que corren en un worker aislado (sandbox) — no pueden tocar tu sistema de archivos ni el proceso de Bifrost, solo la API de terminal que reciben. Edítalos en la barra lateral, en **Scripts**.

Un script es una `async function run(ctx)` con una API pequeña:

| API | Qué hace |
|---|---|
| `ctx.send(texto)` | Escribe texto en el terminal (incluye `\n` para ejecutar) |
| `ctx.log(mensaje)` | Imprime en el log de salida del script en el editor |
| `ctx.sleep(ms)` | Pausa entre pasos |

Ejemplo:

```js
async function run(ctx) {
  ctx.send('uptime\n')
  await ctx.sleep(1000)
  ctx.send('df -h\n')
  ctx.log('chequeo de salud enviado')
}
```

Ejecuta un script guardado contra el terminal vivo desde clic derecho ▸ **Automation ▸ Scripts**.

## Snippets

La vista **Scripts** incluye un navegador de snippets (columna derecha) con una biblioteca de one-liners listos, organizados por categoría — Docker, Kubernetes, System, Network, Git, Disk, Process — más búsqueda de texto completo.

Para cada snippet puedes:

- **Copiarlo** al portapapeles, o
- **Ejecutarlo** en el terminal activo.

Los snippets con placeholders `{{param}}` te piden cada valor antes de ejecutarse.

## Hooks pre/post-conexión

Puedes adjuntar comandos a una conexión que corren automáticamente alrededor de su ciclo de vida. Defínelos al editar una conexión: **formulario de conexión ▸ pestaña HOOKS ▸ + Add Hook**.

Cada hook tiene:

- **Fase** — `PRE` corre justo después de establecerse la conexión SSH; `POST` corre cuando la sesión se desconecta.
- **Comando** — admite tokens de variables como `<USER>`, `<IP>`, `<NAME>`.
- **Ask** — marcado, un diálogo de confirmación nativo muestra el comando exacto y te deja cancelarlo antes de que corra.

Dos cosas que conviene saber:

- Los hooks se ejecutan **localmente en tu máquina** (no dentro de la sesión remota), con un timeout de 30 segundos — están pensados para cosas como actualizar un inventario local, montar algo o disparar una notificación alrededor de una conexión.
- Cada ejecución de hook se escribe en el **log de auditoría**, incluidos los saltos (rechazaste el diálogo de Ask) y los fallos (con el mensaje de error).

## Expansión de variables

Bifrost expande tokens `<VAR>` en títulos dinámicos de pestaña, comandos remotos y hooks de conexión. Tokens verificados:

| Token | Expande a |
|---|---|
| `<IP>` | Host de la conexión |
| `<PORT>` | Puerto de la conexión |
| `<USER>` | Usuario de la conexión |
| `<NAME>` | Nombre de la conexión |
| `<TITLE>` | Título de la sesión |
| `<UUID>` | Id de la conexión |
| `<ENV:nombre>` | Una variable de entorno de tu máquina local |
| `<GV:nombre>` | Una variable global (ver la nota de honestidad abajo) |
| `<TIMESTAMP>` | Timestamp Unix |
| `<DATE_Y>` / `<DATE_M>` / `<DATE_D>` | Año / mes / día |
| `<TIME_H>` / `<TIME_M>` / `<TIME_S>` | Hora / minuto / segundo |

Resolución de ámbito: cuando el mismo nombre está definido globalmente y en una conexión, **gana el valor de la conexión** para esa conexión.

Nota de honestidad sobre `<GV:nombre>`: el motor de expansión resuelve variables globales, pero todavía **no hay editor en la app para definirlas** — la vista Keys es un borrador visual que no persiste nada. Hasta que eso llegue, los tokens `<GV:>` solo resuelven valores que ya existan en la base de datos; en la práctica, trata el token como no utilizable.

## Aún no disponible

- **Motor expect** (automatización patrón → respuesta): el backend existe, pero no hay UI funcional para definir o ejecutar reglas.
- **Macros**: solo backend, sin UI.
- **Editor de variables globales**: sin UI (ver la nota `<GV:>` arriba).
- **Clusters**: el panel de Clusters es un borrador visual no conectado a su backend — no confíes en él.
- **Clusters automáticos** (reglas regex): no alcanzables desde la UI.

---

Anterior: [Sesiones](07-sessions.md) · Siguiente: [Observabilidad y seguridad](09-observability-security.md)

> Specs de origen: openspec/specs/automation/spec.md, openspec/specs/variable-expansion/spec.md — la documentación refleja la implementación a fecha de v0.3.x.
