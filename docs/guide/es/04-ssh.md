[← Índice de la guía](README.md)

# SSH, Mosh y jump hosts

Este capítulo explica cómo Bifrost llega a los hosts remotos: los métodos de conexión que funcionan hoy, la autenticación, la confianza en host keys, el 2FA, la reconexión y las cadenas de saltos multi-hop.

## Métodos de conexión

Hoy funcionan dos métodos de conexión remota:

| Método | Qué es | Notas |
|---|---|---|
| **SSH** | Cliente integrado (`ssh2` en JS puro), sin depender del binario `ssh` externo | Funcionalidad completa: los métodos de autenticación de abajo, verificación de host keys, jump chains, túneles, SFTP |
| **Mosh** | Mobile Shell — sobrevive a cambios de red y enlaces inestables | Se lanza vía PTY usando tu cliente `mosh` del sistema; con soporte de jump chains |

El desplegable de protocolo del formulario de conexión también lista RDP, VNC y Telnet. **Todavía no conectan** — existen lanzadores en el backend, pero seleccionarlos aún no está cableado. De momento, usa SSH y Mosh (ver [Aún no disponible](#aún-no-disponible)).

### Requisitos de Mosh

- `mosh` debe estar instalado en **ambos** extremos: tu máquina (cliente `mosh`) y el servidor (`mosh-server`).
- Los puertos UDP 60000–61000 (o el rango configurado en tu servidor) deben ser accesibles.
- Con una jump chain configurada, la sesión Mosh se arranca a través de la cadena.
- No disponible en Bifrost para Windows.

## Autenticación

Elige el método de autenticación en la pestaña **Basics** del formulario de conexión ([capítulo 2](02-connections.md)):

| Pestaña | Método | Detalles |
|---|---|---|
| PASSWORD | Usuario + contraseña | Las contraseñas guardadas se cifran con el keychain del sistema |
| KEY FILE | Archivo de clave privada | La ruta admite expansión de `~` (p. ej. `~/.ssh/id_ed25519`) |
| CERTIFICATE | Clave privada + passphrase | La passphrase se guarda cifrada y se aplica al cargar la clave |
| HARDWARE KEY | Llave de seguridad FIDO2 | Funciona **solo a través de tu ssh-agent** — ver la nota honesta más abajo |

Además de lo que configures:

- **Agente SSH** — si `SSH_AUTH_SOCK` apunta a un agente en ejecución, Bifrost ofrece automáticamente las claves del agente como fuente adicional de autenticación, igual que hace el comando `ssh` del sistema.
- **Keyboard-interactive (MFA/2FA)** — cuando el servidor envía desafíos keyboard-interactive (p. ej. Duo, OTP de PAM), cada prompt se te reenvía en un diálogo y tus respuestas se envían de vuelta.
- **Errores accionables** — si fallan todos los métodos, el error nombra los métodos intentados (p. ej. `password, ssh-agent`) y sugiere qué revisar, en lugar de un simple "authentication failed".

> **Nota honesta sobre FIDO2**: la librería `ssh2` integrada no puede usar directamente archivos de clave `ed25519-sk` / `ecdsa-sk` (no puede disparar la ceremonia de toque). Una llave por hardware funciona **solo si tu ssh-agent tiene la clave residente cargada** (`ssh-add -K`); en ese caso el soporte automático de agente de Bifrost la usa.

## Verificación de host keys

Bifrost verifica las host keys con el modelo **trust-on-first-use (TOFU)**:

1. **Primera conexión** a un host: un diálogo muestra la **huella SHA-256** del servidor y pide tu confirmación antes de continuar. Compárala con una huella obtenida por otro canal.
2. **Las claves aceptadas** se persisten y se comprueban en cada conexión posterior.
3. **Clave cambiada**: si el servidor presenta una clave que ya no coincide con la almacenada, Bifrost avisa de un posible man-in-the-middle y **nunca conecta en silencio**.

Gestiona las claves almacenadas en **Ajustes → Known Hosts**: el panel lista cada host de confianza con su huella, y eliminar una entrada fuerza la re-verificación en la próxima conexión.

## Auto-escritura de TOTP / 2FA

Puedes guardar un **secreto TOTP en Base32** por conexión (pestaña Basics). Cuando aparece un prompt de código de verificación **en la salida de la sesión**, Bifrost calcula el código vigente y lo escribe por ti.

Ojo al alcance: esto se dispara con prompts dentro de la sesión (p. ej. un "Verification code:" tras el login, o un OTP de `sudo`), **no** durante el handshake SSH — el 2FA del handshake lo gestiona el flujo keyboard-interactive de arriba.

## Reconexión automática

Si una sesión SSH se cae inesperadamente, Bifrost reconecta automáticamente:

- Backoff exponencial: 3 s → 6 s → 12 s → 24 s → 48 s → tope de 60 s.
- Hasta **50 intentos**, con el contador visible en el terminal.
- Si se rinde, pulsa **Enter** en el terminal para reintentar manualmente.

## Reutilización de conexiones

Internamente, Bifrost mantiene **una conexión SSH por host** y la comparte entre consumidores — tu shell, el panel SFTP y los túneles hacia el mismo host viajan por la misma sesión TCP/SSH. La conexión se cierra solo cuando el último consumidor la libera. No tienes que gestionarlo; simplemente significa que abrir SFTP junto a un shell existente no re-autentica ni crea una segunda conexión.

## Cadenas de jump hosts (ProxyJump)

Para llegar a destinos detrás de uno o más bastiones, abre la pestaña **Routing** del formulario de conexión (disponible para SSH y Mosh). El editor visual de cadenas te permite:

- **Añadir saltos** en orden — el tráfico fluye *tu máquina → salto 1 → salto 2 → … → destino*, cada salto es un túnel SSH-sobre-SSH hacia el siguiente.
- **Referenciar una conexión guardada** como salto — se reutilizan su host, credenciales y confianza de host key.
- **Definir un salto inline** — host, puerto, usuario y autenticación (contraseña, archivo de clave, clave + passphrase, o agente). Las contraseñas inline de los saltos se **cifran en reposo**.
- **Reordenar** saltos con las flechas arriba/abajo y eliminarlos individualmente.

Las jump chains se aplican a **shells SSH, sesiones Mosh y túneles** (ver el [capítulo 5](05-tunnels.md) para túneles a través de bastiones). Las host keys se verifican salto a salto, con el mismo flujo TOFU que las conexiones directas.

## Aún no disponible

Lista honesta de lo que puedes ver en la UI pero en lo que no debes confiar:

- **Panel de opciones SSH** (reenvío X11, reenvío de agente, `Ciphers`, `KexAlgorithms`, `MACs`, `HostKeyAlgorithms`, proxy HTTP): el formulario de conexión **guarda** estos campos, pero la ruta de conexión **todavía no los aplica**. Configurarlos no tiene efecto en la sesión.
- **RDP, VNC y Telnet** aparecen en el desplegable de protocolo pero no conectan; **FTP, TN3270, WebDAV y AWS SSM** solo tienen lanzadores en el backend. Hoy solo conectan **SSH y Mosh**.
- **Las claves FIDO2 (sk-keys)** no pueden usarse directamente (ver la nota en Autenticación) — solo claves residentes en el agente.
- **Firma con autoridad certificadora SSH** (certificados de usuario firmados por una CA) aún no tiene UI.

> Especificaciones fuente: `openspec/specs/ssh-connectivity/spec.md`, `openspec/specs/jump-hosts/spec.md`, `openspec/specs/alternative-protocols/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
