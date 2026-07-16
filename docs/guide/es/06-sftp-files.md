[← Índice de la guía](README.md)

# SFTP y archivos

Bifrost transfiere archivos sobre la conexión SSH que ya tienes: cada pestaña SSH puede abrir su propio panel SFTP, y las imágenes del portapapeles se pueden pegar directo al servidor. Este capítulo cubre lo que las herramientas de archivos hacen hoy — y lo que deliberadamente todavía no hacen.

## Abrir el panel SFTP

Haz clic derecho dentro de un terminal SSH y elige **Session ▸ Open SFTP**. El panel se abre junto al terminal, unido a la sesión SSH de esa pestaña — sin segundo login ni credenciales aparte. La misma entrada del menú pasa a ser **Close SFTP** mientras el panel está abierto.

El panel solo está disponible en pestañas respaldadas por una conexión SSH guardada; las pestañas de terminal local no muestran la entrada.

## Navegar directorios remotos

El panel arranca en el directorio home remoto y ofrece:

- Una **barra de ruta** — escribe cualquier ruta absoluta (o `~`) y pulsa Enter para saltar ahí.
- **Subir** (botón ↑) para ir al directorio padre, y **Refrescar** para recargar el listado.
- **Doble clic** en una carpeta para entrar.
- Columnas **Name**, **Modified** (fecha) y **Size**. Haz clic en una cabecera para ordenar por ella; otro clic invierte. El toggle **folders-first** (icono de árbol de carpetas) mantiene los directorios agrupados arriba.
- **Redimensiona** el panel arrastrando su borde izquierdo — el ancho se recuerda mientras la app está abierta, para que los nombres largos se lean bien.

## Operaciones con archivos

| Operación | Cómo | Notas |
|---|---|---|
| Subir | Botón **Upload file** de la barra | Selector de archivos nativo, multi-selección; los archivos aterrizan en el directorio remoto actual |
| Descargar | Icono **Download** en la fila del archivo | Abre un diálogo "Guardar como" para el destino local |
| Renombrar | Icono de **lápiz** en la fila | Pide el nuevo nombre; funciona con archivos y directorios |
| Borrar | Icono de **papelera** en la fila | Pide confirmación primero; funciona con archivos y directorios |
| Nueva carpeta | Botón **New folder** de la barra | Pide un nombre y la crea en el directorio actual |

Todavía no hay edición de permisos (chmod) ni vista de panel dual local/remoto — ver el final de este capítulo.

## Pegar una imagen del portapapeles al servidor

Si tienes una imagen en el portapapeles (una captura de pantalla, por ejemplo), puedes empujarla directo al host remoto desde una pestaña SSH:

- Pulsa **Ctrl+Shift+I**, o
- Clic derecho ▸ **Automation ▸ Paste Image to Server**.

Qué ocurre:

1. La imagen se sube por SFTP — esto funciona también a través de cadenas de jump hosts.
2. La ruta remota del archivo subido se escribe en tu prompt, lista para usar como argumento (`file`, `mv`, un script de subida, lo que estés haciendo).
3. Los archivos temporales creados para el pegado se limpian al salir de la app.

Configúralo en **Settings ▸ Preferences ▸ Terminal**:

| Preferencia | Por defecto | Efecto |
|---|---|---|
| Paste image to server | activada | Interruptor maestro; desactivada, pegar una imagen se comporta como un pegado normal |
| Image upload directory (remote) | `~/.bifrost/pastes` | Dónde se guardan las imágenes pegadas en el servidor (`~` expande al home remoto) |
| Delete uploaded images on app close | activada | Limpia las imágenes subidas cuando Bifrost se cierra |

## Zmodem: se detecta, no se transfiere

Nota de honestidad: Bifrost **no** implementa transferencias Zmodem en el terminal. Si un programa remoto arranca `sz` (enviar) o `rz` (recibir), Bifrost detecta el handshake y muestra una notificación de escritorio que te apunta al panel SFTP. Cancela el `sz`/`rz` en el lado remoto y usa **Session ▸ Open SFTP** para la transferencia.

## Aún no disponible

- Edición de permisos (**chmod**) en el panel SFTP.
- Navegador de archivos de **panel dual** local/remoto.
- Transferencias **Zmodem** en el terminal (solo detección + redirección a SFTP).

---

Anterior: [Túneles y port forwarding](05-tunnels.md) · Siguiente: [Sesiones](07-sessions.md)

> Specs de origen: openspec/specs/file-transfer/spec.md — la documentación refleja la implementación a fecha de v0.3.x.
