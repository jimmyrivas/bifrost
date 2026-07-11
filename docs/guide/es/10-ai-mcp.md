[← Índice de la guía](README.md)

# IA y MCP

Bifrost integra la IA en dos direcciones: un **Asistente IA** dentro de la app que te ayuda *a ti* mientras trabajas en el terminal, y un **servidor MCP** que permite a agentes de IA (como Claude Code) operar el inventario de Bifrost — conexiones, SSH, SFTP, túneles, clústeres — desde fuera.

## Panel de Asistente IA

Pulsa **Ctrl+Shift+A** (o clic derecho en un terminal → **Automation ▸ AI Assistant**) para alternar el panel del asistente.

- **Acoplado o desacoplado**: el panel se acopla al lateral del espacio de trabajo; un asa de redimensionado ajusta su ancho (persistido entre reinicios), y un botón en su cabecera lo mueve a su propia ventana. Desacoplado, sigue siendo plenamente funcional y **sigue a la pestaña activa** — los prompts siempre usan la conexión y el contexto de terminal de la sesión activa.
- **Editor de prompts**: multilínea; **Enter** envía, **Shift+Enter** inserta una nueva línea. El envío se deshabilita mientras una respuesta sigue en streaming.
- **Respuestas en streaming** que se renderizan a medida que llegan.
- **Acciones de copia**: clic derecho en cualquier respuesta para **Copy** (texto plano — la selección si tienes una, si no el mensaje completo), **Copy as Markdown** (siempre la fuente Markdown completa) y **Copy as CSV** (extrae tablas Markdown a CSV RFC 4180, con fallbacks para filas de pipes sueltas y texto alineado con espacios). El mismo menú funciona en la ventana desacoplada.

### Proveedores

Configura el modelo en **Settings → AI**:

| Proveedor | Notas |
| --- | --- |
| Ollama | Modelos locales; configura la URL de Ollama (por defecto `http://localhost:11434`) |
| OpenRouter | Requiere clave API |
| OpenAI | Requiere clave API |
| DeepSeek | Requiere clave API |

Proveedor, nombre de modelo y clave API se configuran en el mismo panel. El asistente, [Explain Command](#explain-command), la detección de errores y los resúmenes de inactividad usan todos esta configuración.

## Explain Command

Selecciona cualquier texto en un terminal, clic derecho → **Automation ▸ Explain Command**. Bifrost pide al modelo configurado que explique el comando; cuando no hay modelo configurado (o no responde), una biblioteca de explicaciones integrada cubre los comandos comunes, así que la función se degrada con elegancia en lugar de fallar.

## Detección de errores y resúmenes de inactividad

Las funciones de IA también reaccionan a tu sesión: los errores detectados aparecen como badges, y las sesiones inactivas con salida significativa ofrecen un resumen IA bajo demanda que puedes guardar como nota. Ambas se describen en [Observabilidad y seguridad](09-observability-security.md).

## Servidor MCP

Bifrost incluye un servidor standalone de [Model Context Protocol](https://modelcontextprotocol.io/) (`src/mcp/`) que expone tu infraestructura a agentes de IA. Corre como su propio proceso Node — independiente de la app de Bifrost — y lee la base de datos de Bifrost en **solo lectura** vía `sql.js`, de modo que nunca puede modificar tus conexiones.

### Lo que obtienen los agentes

**42 herramientas** en nueve dominios:

| Dominio | Herramientas | Ejemplos |
| --- | --- | --- |
| Conexiones | 5 | `list_connections`, `get_connection`, `list_groups` |
| SSH | 3 | `ssh_connect`, `ssh_execute`, `ssh_disconnect` |
| Terminal | 4 | `terminal_create`, `terminal_execute`, `terminal_read_buffer` |
| SFTP | 8 | `sftp_read_file`, `sftp_write_file`, `sftp_list_directory` |
| Clústeres | 2 | `cluster_execute`, `cluster_multi_host_diff` |
| Túneles | 4 | `tunnel_start`, `tunnel_stop`, `tunnel_create_adhoc` |
| Descubrimiento | 8 | `discover_aws`, `discover_docker`, `discover_kubernetes` |
| Automatización | 6 | `list_snippets`, `execute_script`, `resolve_variables` |
| Observabilidad | 2 | `audit_query`, `health_ping` |

Además, **9 recursos** bajo URIs `bifrost://` (`bifrost://connections`, `bifrost://groups`, `bifrost://clusters`, `bifrost://tunnels`, `bifrost://audit/recent`, `bifrost://snippets`, `bifrost://scripts`, `bifrost://variables`, `bifrost://commands`) y **8 plantillas de prompt** para flujos guiados (diagnosticar una conexión, desplegar a un clúster, configurar un túnel, descubrir infraestructura, auditoría de seguridad, migración de servidor, respuesta a incidentes, configuración masiva).

### Configuración con Claude Code

Desde el árbol de código fuente de Bifrost:

```bash
pnpm mcp:install
```

Esto registra el servidor en `~/.claude/settings.json` y habilita una skill `/bifrost` en Claude Code. Para configurar cualquier cliente MCP manualmente:

```json
{
  "mcpServers": {
    "bifrost": {
      "command": "npx",
      "args": ["tsx", "<ruta-a-bifrost>/src/mcp/index.ts"]
    }
  }
}
```

### Transportes

- **stdio** (por defecto) — para agentes locales como Claude Code: `pnpm mcp:dev`.
- **Streamable HTTP** en el puerto **3100** — para acceso remoto o multi-cliente: `pnpm mcp:http`. Las peticiones deben llevar un token Bearer (variable de entorno `BIFROST_MCP_TOKEN`); solo `/health` es público.

### Modelo de seguridad

- **Filtro de comandos destructivos**: toda herramienta que ejecuta comandos pasa por un filtro que bloquea operaciones críticas (`rm -rf /`, `DROP TABLE`, fork bombs, `mkfs`, `dd if=/dev/zero`, …) y antepone una advertencia a las arriesgadas (`chmod 777`, `curl | sh`, `shutdown`). El filtro es basado en regex — trátalo como un cinturón de seguridad, no como un sandbox.
- **Base de datos de solo lectura**: el servidor no puede crear ni modificar conexiones.
- **Frontera de credenciales, por diseño**: el servidor MCP **no puede descifrar las credenciales guardadas por Bifrost** — `safeStorage` está ligado al contexto de llavero de la app Electron. Los agentes se autentican por SSH vía (1) archivos de clave leídos del disco, (2) el agente SSH, o (3) un parámetro `password` explícito en `ssh_connect`. Tus contraseñas guardadas nunca salen de la app.

Los detalles de arquitectura y el inventario completo de herramientas están en [`docs/MCP_ARCHITECTURE.md`](../../MCP_ARCHITECTURE.md).

## Aún no disponible

No falta nada importante en esta área. Dos advertencias honestas: las sesiones MCP viven en el proceso del servidor (un reinicio pierde las sesiones SSH/terminal activas), y el sistema planificado de niveles de permiso por herramienta aún no se aplica — las 42 herramientas están disponibles para cualquier agente conectado.

> Especificaciones fuente: `openspec/specs/ai-assistant/spec.md`, `openspec/specs/mcp-integration/spec.md`, `openspec/specs/session-observability/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
