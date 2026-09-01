[← Índice de la guía](README.md)

# SFTP y archivos

Bifrost transfiere archivos sobre la conexión SSH que ya tienes: cada pestaña SSH puede abrir su propio panel SFTP, y las imágenes del portapapeles se pueden pegar directo al servidor. Este capítulo cubre lo que las herramientas de archivos hacen hoy — y lo que deliberadamente todavía no hacen.

## Abrir el panel SFTP

Haz clic derecho dentro de un terminal SSH y elige **Session ▸ Open SFTP**. El panel se abre junto al terminal, unido a la sesión SSH de esa pestaña — sin segundo login ni credenciales aparte. La misma entrada del menú pasa a ser **Close SFTP** mientras el panel está abierto.

El panel solo está disponible en pestañas respaldadas por una conexión SSH guardada; las pestañas de terminal local no muestran la entrada.

## Navegar directorios remotos

El panel abre en el **directorio de trabajo del shell** cuando puede detectarlo
(si no, cae al home remoto). Ofrece:

- Un **breadcrumb** de la ruta actual — haz clic en un segmento (o en la `/`
  inicial) para saltar a ese ancestro.
- Una **barra de ruta** — escribe cualquier ruta absoluta (o `~`) y pulsa Enter.
- **Subir** (↑) al padre, **Refrescar**, y **Sincronizar al directorio del shell**
  (icono de carpeta con flecha) para volver a donde está tu shell.
- **Doble clic** en una carpeta para entrar.
- Columnas **Name**, **Modified** y **Size**. Clic en una cabecera para ordenar;
  otro clic invierte. El toggle **folders-first** mantiene los directorios arriba.
- **Redimensiona** el panel arrastrando su borde izquierdo — el ancho se recuerda.

## Operaciones con archivos

| Operación | Cómo | Notas |
|---|---|---|
| Subir | Botón **Upload** de la barra | Elige **archivos y/o carpetas**; las carpetas suben recursivamente al directorio actual |
| Descargar (uno) | Icono **Download** en la fila | Diálogo "Guardar como"; queda en el historial |
| Descargar (varios) | Marca las **casillas** y **Download to folder…** | Cualquier mezcla de archivos y carpetas; elige una carpeta destino y todo se transfiere, carpetas recursivamente, preservando estructura |
| Renombrar | Icono de **lápiz** en la fila | Pide el nuevo nombre; archivos y directorios |
| Borrar | Icono de **papelera** en la fila | Confirma primero; archivos y directorios |
| Nueva carpeta | Botón **New folder** de la barra | Pide un nombre en el directorio actual |

## Historial de descargas

Cada descarga se recuerda. Ábrelo con el icono de **historial** (reloj) en la
cabecera del panel SFTP: cada entrada muestra el archivo, dónde se guardó, su
tamaño y cuándo — con acciones **Reveal** (abrir el explorador ahí) y **Open**.

## Descargar un Markdown que estás viendo

Al abrir un `.md` remoto en el visor Markdown, usa su botón **Download** para
guardar el archivo por SFTP (también queda en el historial).

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
