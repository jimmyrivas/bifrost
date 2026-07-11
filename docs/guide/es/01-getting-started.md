[← Índice de la guía](README.md)

# Primeros pasos

Bifrost es un gestor de conexiones de escritorio para Linux — el sucesor espiritual de Ásbrú Connection Manager. Está pensado para sysadmins, DevOps y equipos DevSecOps que administran decenas o cientos de servidores remotos, SSH primero, con un terminal moderno. Bifrost es software libre bajo la licencia GPL-3.0-or-later. Estado actual: **alpha (v0.3.x), solo Linux** — el soporte para Windows y macOS está en la hoja de ruta.

## Instalación

### Paquetes precompilados

Descarga el último AppImage, `.deb` o `.rpm` desde la [página de releases en GitHub](https://github.com/jimmyrivas/bifrost/releases) (el proyecto también vive en GitLab). Para el AppImage:

```bash
chmod +x Bifrost-*.AppImage
./Bifrost-*.AppImage
```

Verifica la descarga contra los checksums publicados:

```bash
sha256sum -c SHA256SUMS
```

> **Nota sobre el keyring:** en Linux sin un servicio de keyring (gnome-keyring o kwallet), las credenciales guardadas caen a un almacenamiento ofuscado y Bifrost muestra una advertencia. Instala un keyring para tener cifrado real. Ver [Gestión de conexiones](02-connections.md#credenciales-guardadas) para más detalles.

### Compilar desde el código fuente

Requisitos: Node.js 20+, [pnpm](https://pnpm.io) 10.x y herramientas de compilación para módulos nativos (`python3`, `make`, `g++`).

```bash
git clone https://github.com/jimmyrivas/bifrost.git
cd bifrost
pnpm install
pnpm rebuild        # recompila módulos nativos contra el ABI de Electron
pnpm dev            # modo desarrollo con recarga en caliente
pnpm package        # produce AppImage / deb / rpm en dist/
```

## Primer arranque: un recorrido por la ventana

Al abrir Bifrost verás:

- **Barra lateral de conexiones** (izquierda) — un árbol con tus conexiones, organizado en grupos, con secciones de Favoritos y Recientes, búsqueda en vivo y badges de tags. El clic derecho sobre una conexión o grupo abre su menú contextual. Ver [Gestión de conexiones](02-connections.md).
- **Barra de pestañas** (arriba) — cada shell local y sesión SSH vive en una pestaña. Las pestañas se pueden dividir en paneles y separar a su propia ventana.
- **Área del terminal** (centro) — el terminal de la pestaña activa. Haz clic derecho para abrir el menú contextual del terminal (formatos de copia, buscar, comandos remotos y más).
- **Asistente IA** — un panel acoplable que se activa con `Ctrl+Shift+A`. Transmite respuestas en streaming desde Ollama, OpenRouter, OpenAI o DeepSeek; configura el proveedor, el modelo y la clave API en Ajustes.
- **Paleta de comandos** — pulsa `Ctrl+K` para una paleta con búsqueda difusa sobre tus conexiones y comandos.
- **Ajustes** — preferencias, esquemas de color, known hosts, notas, plugins y sincronización de configuración vía git.

Otras cosas útiles el primer día:

- **El estado de la ventana persiste**: posición y tamaño se restauran en el siguiente arranque.
- **Restauración de sesión**: al relanzar, Bifrost ofrece reabrir tus pestañas anteriores y reconectarlas.
- **Bandeja del sistema**: Bifrost añade un icono a la bandeja. Ten en cuenta que los menús de conexiones de la bandeja aún no se rellenan — usa la barra lateral o la paleta de comandos para conectar.
- **Pantalla completa**: pulsa `F11` para alternar pantalla completa.
- **Buscar en el terminal**: pulsa `Ctrl+Shift+F` en un terminal, o haz clic derecho y elige *Find in Terminal*, para abrir la barra de búsqueda. `Ctrl+F` a secas se pasa al shell.

## Atajos de teclado principales

Bifrost trae un conjunto fijo de atajos globales (existe un editor de atajos personalizados en Ajustes, pero todavía no reemplaza estos atajos integrados):

| Atajo | Acción |
| --- | --- |
| `Ctrl+K` | Abrir la paleta de comandos |
| `Ctrl+Shift+A` | Mostrar/ocultar el panel del asistente IA |
| `Ctrl+T` | Nueva pestaña de terminal local |
| `Ctrl+W` | Cerrar la pestaña activa |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Pestaña siguiente / anterior |
| `Ctrl+1`…`Ctrl+9` | Saltar a la pestaña por número |
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copiar / pegar en el terminal |
| `Ctrl+Shift+H` / `Ctrl+\` | Dividir el panel en horizontal / vertical |
| `Ctrl+Shift+M` | Maximizar / restaurar el panel con foco |
| `Ctrl+Shift+B` | Ciclar el modo broadcast (apagado → todos los paneles → todas las pestañas) |
| `Ctrl+Shift+F` | Buscar en el terminal con foco |
| `Ctrl+Shift+I` | Pegar una imagen del portapapeles al servidor conectado |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Acercar / alejar / restablecer zoom (por pestaña) |
| `F11` | Alternar pantalla completa |

Dentro del terminal, `Ctrl+C` es inteligente: copia cuando hay texto seleccionado y envía una interrupción cuando no hay nada seleccionado.

## Idioma y plataformas

- La UI está en **inglés**; la traducción al español está en progreso.
- **Solo Linux** por hoy. El soporte para Windows y macOS está en la hoja de ruta.

## Aún no disponible

- Los menús de conexiones de la bandeja están vacíos (el icono de la bandeja en sí funciona).
- El editor de atajos personalizados de Ajustes guarda tus cambios pero todavía no reemplaza los atajos integrados.
- Builds para Windows y macOS, y la traducción completa de la UI al español.

> Specs de origen: `openspec/specs/app-shell/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
