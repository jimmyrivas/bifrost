[← Índice de la guía](README.md)

# Sesiones que sobreviven

Cerrar una pestaña — o el propio Bifrost — no tiene por qué significar perder tu trabajo. Bifrost integra multiplexores de terminal reales para la persistencia de sesiones locales, restaura tus pestañas abiertas al relanzar y reconecta automáticamente las sesiones SSH caídas.

> La interfaz de Bifrost está (por ahora) mayormente en inglés, así que los nombres de menús y opciones se citan en inglés tal como aparecen en pantalla.

## Multiplexores: dtach, tmux, zellij, rmux

Bifrost persiste las sesiones locales de terminal ejecutándolas dentro del multiplexor que elijas: **dtach**, **tmux**, **zellij** o **rmux** (un multiplexor compatible con tmux, manejado con los mismos comandos). El shell sigue ejecutándose dentro del multiplexor aunque la pestaña — o la aplicación entera — ya no esté.

Al conectar, Bifrost **sondea** el multiplexor configurado y las sesiones existentes:

- Si existen sesiones, aparece un **selector de attach** que las lista — sesiones vivas para retomar (scrollback intacto, procesos aún en marcha) y sesiones obsoletas. Elige una para reincorporarte, o crea una sesión nueva. El selector también puede matar una sesión o limpiar las obsoletas.
- Los nombres de sesión son **deterministas**, derivados del contexto de la conexión o la pestaña con el prefijo que configures (por defecto `bifrost-{conn}`, donde `{conn}` se expande al nombre de la conexión), de modo que la misma conexión siempre encuentra sus propias sesiones.
- Con **Auto-attach if single session** activado, Bifrost se salta el selector y se reincorpora directamente cuando hay exactamente una sesión viva.

## Configuración de multiplexor por conexión

Cada conexión tiene un panel de multiplexor en su editor: multiplexor preferido, un fallback para cuando el principal no está instalado en el host, y argumentos personalizados. El panel solo muestra los campos que el multiplexor seleccionado realmente soporta:

| Campo | tmux / rmux | zellij | dtach |
| --- | --- | --- | --- |
| Config file | ✓ (`-f <archivo>`) | ✓ (`--config <archivo>`) | — |
| Layout | — | ✓ (`--layout <valor>`) | — |
| Extra arguments | ✓ | ✓ | ✓ |

- **Config file** — un archivo de configuración del multiplexor que se pasa tanto al crear como al reincorporarse. `~` y las variables de shell como `$HOME` en la ruta se expanden en el host remoto, así que `~/.tmux.work.conf` funciona como esperas. dtach no lee archivo de configuración, por lo que el campo se oculta.
- **Layout** (solo zellij) — un nombre de layout registrado (`dev`) o la ruta a un archivo `.kdl` (`~/layouts/dev.kdl`). Se aplica **solo al crear** una sesión nueva; reincorporarse a una sesión existente nunca vuelve a aplicar el layout.
- **Extra arguments** — una vía de escape libre que se inserta tal cual en el comando del multiplexor (antes del subcomando; en dtach, antes del shell), tanto al crear como al reincorporarse. Los flags de varios tokens como `-r winch` pasan intactos — no se aplica ningún quoting, así que lo que escribes es exactamente lo que se ejecuta en tu host.

Dejar cualquier campo vacío no añade nada al comando. Las configuraciones guardadas antes de que existieran estos campos siguen funcionando — los campos nuevos simplemente quedan vacíos por defecto.

## Restauración de sesión al relanzar

Bifrost recuerda tus pestañas abiertas. En el siguiente arranque, si hay algo que restaurar, **pregunta primero** — acepta para reabrir la sesión anterior, o rechaza para empezar de cero. No aparece ningún aviso cuando no hay nada que restaurar.

Qué hace la restauración:

- **Las pestañas SSH** se recrean y reconectan por la ruta de conexión normal — se te pedirán credenciales si la conexión las requiere.
- **Las pestañas locales** se restauran **solo si estaban multiplexadas**; un shell local sin multiplexor no puede sobrevivir a la aplicación, así que no se guarda.
- Una pestaña restaurada cuya sesión de multiplexor sigue viva **se reincorpora** a ella — el scrollback y los procesos en marcha vuelven.
- **Los layouts divididos no se recrean**: cada pestaña vuelve solo con su panel raíz.
- Las pestañas cuya conexión fue **eliminada se saltan en silencio**; el resto se restaura con normalidad.

## Reconexión automática SSH

Cuando una sesión SSH se cae inesperadamente, Bifrost reconecta por su cuenta con backoff exponencial: el primer reintento a los **3 segundos**, duplicándose cada vez hasta un tope de **60 segundos**, durante un máximo de **50 intentos**. Cada intento se anuncia en el terminal (`Reconnecting (attempt 3/50)... [retry in 12s]`).

Si todos los intentos fallan, Bifrost se detiene e imprime `Press Enter to reconnect manually` — pulsar `Enter` en ese terminal reinicia el contador y vuelve a empezar. Si la conexión usa un multiplexor, una reconexión exitosa pasa por el mismo sondeo, así que aterrizas de vuelta en tu sesión.

## Ventanas separadas y reincorporadas

Mover una pestaña a su propia ventana — y readoptarla en la ventana principal con su sesión viva intacta — es parte de la misma historia: las sesiones sobreviven a la superficie donde se muestran. Ver [Separar a una ventana — y traerla de vuelta](03-terminal.md#separar-a-una-ventana--y-traerla-de-vuelta) en el capítulo del Terminal.

## Aún no disponible

- Bifrost es por ahora **solo para Linux**; el soporte de Windows y macOS está en la hoja de ruta, así que la persistencia de sesiones asume hosts y shells Linux.

> Especificaciones fuente: `openspec/specs/session-multiplexing/spec.md`, `openspec/specs/multiplexer-custom-args/spec.md`, `openspec/specs/session-restore/spec.md` — la documentación refleja la implementación a fecha de v0.3.x.
