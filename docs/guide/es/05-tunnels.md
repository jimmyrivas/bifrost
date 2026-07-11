[← Índice de la guía](README.md)

# Reenvío de puertos (túneles)

Bifrost crea y gestiona túneles de reenvío de puertos SSH — local, remoto y dinámico (SOCKS5) — persistidos como objetos de primera clase que puedes iniciar, detener y auto-arrancar, independientes de cualquier pestaña de terminal abierta.

## El gestor de túneles

Abre **Tunnels** en la barra lateral izquierda. El gestor muestra cada túnel guardado con su estado en vivo (activo/detenido y tiempo de actividad, refrescado cada 5 segundos) y los controles **Start**, **Stop** y **Stop All**.

Una definición de túnel consta de:

| Campo | Significado |
|---|---|
| Nombre | Etiqueta mostrada en la lista |
| Origen | O una **conexión guardada** (reutiliza su host, credenciales y jump chain) o un **host introducido manualmente** con sus propias credenciales |
| Reenvíos | Uno o más reenvíos (un mismo túnel puede llevar varios) |
| Jump chain | Cadena de bastiones opcional, con el mismo editor que las conexiones ([capítulo 4](04-ssh.md#cadenas-de-jump-hosts-proxyjump)) |
| Auto-start | Arrancar este túnel automáticamente cuando se inicia Bifrost |

## Tipos de túnel

| Tipo | Dirección | Campos |
|---|---|---|
| **Local** | `127.0.0.1:puertoLocal` en tu máquina → `hostRemoto:puertoRemoto` visto desde el servidor | Puerto local, host remoto, puerto remoto |
| **Remote** | Puerto en el servidor → una dirección accesible desde tu máquina | Puerto local, host remoto, puerto remoto |
| **Dynamic** | Proxy SOCKS5 en `127.0.0.1:puertoLocal` — el destino se elige por petición | Solo puerto local |

### Ejemplo de reenvío local

Base de datos en `db.internal:5432`, accesible solo desde el servidor SSH: crea un reenvío local `5432 → db.internal:5432`, arranca el túnel y apunta tu cliente a `127.0.0.1:5432`.

### Reenvío dinámico (SOCKS5)

Un reenvío dinámico ejecuta un proxy SOCKS5 real vinculado a `127.0.0.1`, respaldado por la conexión SSH del túnel. Cada conexión TCP que envíes a través de él sale por el servidor SSH. Soporta: handshake sin autenticación, comando `CONNECT`, y direcciones de destino IPv4, por nombre de dominio e IPv6.

Úsalo desde la línea de comandos:

```bash
curl --socks5 127.0.0.1:1080 http://internal-service.corp/
# o con resolución DNS remota:
curl --socks5-hostname 127.0.0.1:1080 http://internal-service.corp/
```

O configúralo como proxy SOCKS del navegador o del sistema (`127.0.0.1`, el puerto que elijas) para navegar por una red interna a través del servidor SSH.

## Ciclo de vida

- **Guardar** una definición; persiste entre reinicios.
- **Start** — se establece la conexión SSH (o se reutiliza, si ya existe una hacia ese host) y cada reenvío se levanta; el estado pasa a activo con contador de tiempo.
- **Stop** — los reenvíos se desmontan; **Stop All** detiene todos los túneles activos.
- **Auto-start** — los túneles marcados con auto-start se establecen al iniciar la aplicación, sin intervención del usuario.

## Credenciales por túnel

Los túneles con host manual llevan su propio usuario y autenticación (contraseña, archivo de clave, clave + passphrase). Las contraseñas y passphrases se **cifran con el keychain del sistema** al guardarse — el formulario solo indica si existe una contraseña guardada, nunca su valor.

## Túneles a través de jump hosts

Si el destino del túnel solo es accesible vía un bastión, añade una jump chain en el editor del túnel. El reenvío se establece entonces a través de la cadena, salto a salto — el mismo comportamiento que las sesiones SSH ([capítulo 4](04-ssh.md)).

## Notas de seguridad

- Los listeners locales y dinámicos se vinculan **solo a `127.0.0.1`** — nada en tu LAN puede alcanzar tus túneles ni tu proxy SOCKS.
- El proxy SOCKS5 acepta conexiones sin autenticación **por diseño**, precisamente porque es solo-localhost. No lo redirijas ni lo expongas a otras máquinas.

## Aún no disponible

Nada relevante. Dos límites de alcance deliberados en el proxy SOCKS5:

- Sin autenticación SOCKS (solo-localhost por diseño, ver arriba).
- Los comandos `UDP ASSOCIATE` y `BIND` no están soportados — solo `CONNECT` sobre TCP, la misma limitación que el `-D` de OpenSSH.

> Especificaciones fuente: `openspec/specs/port-forwarding/spec.md`, `openspec/specs/jump-hosts/spec.md`, `openspec/specs/ssh-connectivity/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
