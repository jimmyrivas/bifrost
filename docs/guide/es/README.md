# Guía de usuario de Bifrost

Documentación práctica de Bifrost, derivada de las [especificaciones de capacidades OpenSpec](../../../openspec/specs/) del proyecto y verificada contra el código — cada funcionalidad descrita aquí tiene una ruta de UI funcional a fecha de **v0.3.x**. Lo que existe solo en el backend, o es una limitación conocida, se señala honestamente en la sección *"Aún no disponible"* de cada capítulo (y en los niveles de funcionalidades del [README](../../../README.es.md)).

**[English version →](../README.md)**

## Capítulos

| # | Capítulo | Qué cubre |
| --- | --- | --- |
| 01 | [Primeros pasos](01-getting-started.md) | Instalación, primer arranque, recorrido por la ventana, atajos de teclado |
| 02 | [Conexiones](02-connections.md) | CRUD, grupos, plantillas, favoritos, búsqueda, notas, estadísticas, WoL, workspaces, credenciales, TOTP, sincronización git |
| 03 | [El terminal](03-terminal.md) | Pestañas, paneles, el menú de clic derecho, broadcast, seguridad al pegar, buscar, copiar como Markdown/CSV, pegar imágenes, apariencia, captura, separar/reincorporar |
| 04 | [SSH, Mosh y jump hosts](04-ssh.md) | Métodos de autenticación, host keys (TOFU), MFA/TOTP, reconexión automática, cadenas de jump hosts, Mosh |
| 05 | [Reenvío de puertos](05-tunnels.md) | Túneles locales, remotos y dinámicos (SOCKS5); auto-arranque; jump chains |
| 06 | [SFTP y archivos](06-sftp-files.md) | Panel SFTP, subida de imágenes del portapapeles, nota sobre Zmodem |
| 07 | [Sesiones que sobreviven](07-sessions.md) | Multiplexores (dtach/tmux/zellij/rmux), argumentos personalizados, restauración de sesión, reconexión automática |
| 08 | [Automatización](08-automation.md) | Comandos remotos, runbooks, scripts, snippets, hooks de conexión, expansión de variables |
| 09 | [Observabilidad y seguridad](09-observability-security.md) | Grabación de sesiones, logs de sesión, log de auditoría, salud, detección de errores, redacción de secretos, seguridad de credenciales |
| 10 | [IA y MCP](10-ai-mcp.md) | Panel de asistente IA, proveedores, explicar comandos, el servidor MCP para agentes de IA |

## Otra documentación

- [`README.es.md`](../../../README.es.md) — resumen de funcionalidades con niveles honestos (verificado / solo backend / limitaciones)
- [`docs/MCP_ARCHITECTURE.md`](../../MCP_ARCHITECTURE.md) — diseño y decisiones del servidor MCP (en inglés)
- [`docs/PLUGIN_API.md`](../../PLUGIN_API.md) / [`docs/PLUGIN_DEV_GUIDE.md`](../../PLUGIN_DEV_GUIDE.md) — sistema de plugins (en inglés)
- [`docs/reference/DESIGN.md`](../../reference/DESIGN.md) — el sistema de diseño Spectral Command (en inglés)
- [`CHANGELOG.md`](../../../CHANGELOG.md) — historial por versión (en inglés)

> ¿Encontraste algo documentado aquí que no funciona? Es un bug de la documentación o de la app — por favor [abre un issue](https://github.com/jimmyrivas/bifrost/issues).
