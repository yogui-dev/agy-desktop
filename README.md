# 🛸 AGY Desktop — Antigravity Agent Control Plane

**AGY Desktop** es una aplicación de escritorio nativa para Windows (React 19 + Electron 34 + Tailwind CSS + Vite 6) diseñada como centro de control, orquestación y entorno interactivo para **Antigravity CLI**.

Permite interactuar con los agentes de Antigravity en tiempo real, visualizar telemetría multi-sesión, coordinar bloqueos de archivos (*path locks*) para prevenir colisiones entre agentes concurrentes y comunicarse entre sesiones, **todo directamente dentro de la interfaz gráfica sin abrir ventanas de terminal externas**.

---

## ✨ Características Principales

### 1. 💬 Agente Interactivo In-App (Sin Ventanas de Terminal)
- **Ejecución 100% Embebida:** Las instrucciones se procesan a través del motor headless de Antigravity (`agy.exe` con `--output-format stream-json`) en segundo plano sin desplegar ventanas de PowerShell o Windows Terminal (`windowsHide: true`).
- **Streaming de Tokens en Tiempo Real:** Visualización en vivo de los deltas de texto generados por el modelo a 60 fps.
- **Trazabilidad de Herramientas:** Indicadores visuales interactivos de cada herramienta ejecutada durante el turno (`read_file`, `edit_file`, `run_command`, etc.) con su estado (`ACTIVE`, `DONE`, parámetros).
- **Control de Turno:** Botón para cancelar o detener la ejecución en vivo en cualquier momento.
- **Selector de Modelos en Caliente:** Conmuta entre modelos disponibles (`gemini-3.8-flash-high`, `claude-sonnet-4-6`, etc.) directamente desde la cabecera.

### 2. 🔑 Cero Login Adicional (Zero-Auth)
- Hereda directamente las credenciales existentes de Windows Credential Manager (`gemini:antigravity`).
- Sin necesidad de configurar API keys o autenticaciones duplicadas.
- Comparte automáticamente tus configuraciones, workspaces, servidores MCP y plugins habilitados.

### 3. 🛡️ Coordinación Multi-Sesión & Path Locking (`session-mesh`)
- **Mission Control en Vivo:** Supervisa todas las sesiones de Antigravity CLI activas en la máquina local: ID de conversación, último prompt del usuario, herramientas activas y tareas asíncronas en progreso.
- **Detección Atómica de Presencia:** Detección en sub-milisegundos de sesiones vivas o terminadas mediante validación de descriptores de archivo Win32 (`~/.gemini/antigravity-cli/presence/*.lock`), purgando bloqueos huérfanos sin sobrecarga de sondeo.
- **Gestión Visual de Locks:** Bloquea directorios o archivos (`lock-path`) antes de realizar cambios estructurales y libéralos (`unlock-path`) al finalizar.
- **Protección Automática:** Se integra con el hook global `PreToolUse` de Antigravity, bloqueando intentos de edición concurrentes en rutas reservadas por otra sesión.

### 4. 📎 Adjuntar Archivos & Arrastrar y Soltar (Drag & Drop)
- **Soporte Universal de Archivos:** Adjunta código (`.js`, `.py`, `.ts`, `.html`), documentos (`.pdf`, `.docx`, `.txt`, `.csv`), imágenes (`.png`, `.jpg`, `.webp`) o configuraciones (`.json`, `.yaml`, `.env`).
- **Arrastrar y Soltar Nativo (Drag & Drop):** Arrastra archivos directamente desde el Explorador de Windows a la ventana del chat con indicación visual de zona de captura (*dropzone*).
- **Bandeja de Adjuntos (Chips):** Muestra el nombre, tamaño y tipo de archivo con opción de remover archivos individuales antes de ejecutar el turno.
- **Trazabilidad en Mensajes:** Los mensajes del usuario muestran tarjetas interactivas de los archivos adjuntos analizados por el agente.

### 5. 📡 Tablón de Mensajería Inter-Agente (Mesh Chat)
- Envía mensajes reactivos directos (`send-message`) a otra sesión específica de la flota.
- Difunde avisos globales (*broadcast*) para alertar a todos los agentes en ejecución.

### 6. 🎙️ Interacción por Voz & Comprensión de Audio (Whisper & Catalina)
- **Grabación Directa con Micrófono:** Graba instrucciones habladas desde el botón de micrófono en la barra de chat con temporizador en vivo y controles de cancelación/confirmación.
- **Transcripción Inteligente con OpenAI Whisper:** Transcribe el audio en sub-segundos con sesgo de vocabulario especializado para términos de ingeniería (`Jorge`, `Yogui`, `Antigravity`, `CLI`, `Git`, `Electron`, etc.).
- **Adjuntar y Transcribir Archivos de Audio:** Carga y transcribe archivos de audio existentes (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.webm`, `.flac`).
- **Lectura en Voz Alta (TTS):** Escucha las respuestas del asistente con la voz chilena oficial **Catalina Cálida** (`es-CL-CatalinaNeural`) mediante el botón de altavoz en cada mensaje.

### 7. 💾 Historial Persistente & Gestión de Conversaciones
- Guarda automáticamente cada conversación en almacenamiento local, sobreviviendo al cierre y reinicio de la aplicación.
- Pestaña **Historial** en la barra lateral para navegar entre conversaciones previas, continuar chats anteriores o descartar los que ya no se necesiten.
- Sincronización continua de IDs con Antigravity CLI para reanudar el contexto previo del agente.

### 8. 📂 Selector Dinámico de Workspace & Proyectos
- Selector directo en la cabecera superior para conmutar entre diferentes carpetas de proyectos del workspace (`C:\Proyectos\yoguidev`, subproyectos o cualquier directorio del equipo).
- Botón de exploración para abrir el selector nativo de carpetas de Windows y cargar cualquier repositorio al vuelo sin reiniciar la aplicación.

### 9. ⚡ Slash Commands (`/`) & Atajos Rápidos
- Popover inteligente de autocompletado al escribir `/` en la barra de chat con filtrado en vivo de skills especializadas:
  - `/brainstorming`: Explorar ideas, requerimientos y diseño antes de implementar.
  - `/tdd-workflow`: Desarrollo guiado por pruebas (TDD) y cobertura estricta.
  - `/security-review`: Auditoría integral de vulnerabilidades, secrets y auth.
  - `/codehealth`: Revisar salud de código, refactorización y deuda técnica.
  - `/benchmark`: Medir tiempos de respuesta, rendimiento y latencia.
  - `/explain`: Explicar detalladamente la arquitectura y funcionamiento.
  - `/fix-defect`: Reproducir y corregir un bug con test de regresión.
  - `/goal`: Ejecutar tarea a fondo hasta completarla al 100%.
- Píldoras de acceso rápido sobre la barra de entrada cuando el campo está vacío para invocar comandos con un solo click.

### 10. 🛸 Segundo Plano, Bandeja del Sistema (Tray) & Atajo Global
- **Minimización a la Bandeja:** Al cerrar la ventana, la aplicación continúa ejecutándose en segundo plano en el System Tray de Windows.
- **Atajo Global:** Presiona `Ctrl + Shift + Espacio` (o `Cmd + Shift + Space`) desde cualquier parte del sistema operativo para mostrar u ocultar la ventana al instante.
- **Notificaciones Nativas:** Avisos de Windows cuando el agente completa un turno en segundo plano o con la ventana desenfocada.

### 11. 📊 Métricas de Consumo de Tokens & Quota Tracking
- Inspección en tiempo real de los tokens procesados en cada turno mediante el stream NDJSON del agente:
  - Tokens totales acumulados.
  - Tokens de entrada (*input*), salida (*output*) y pensamiento (*thinking tokens*).
  - Badge interactivo con ícono de energía (`⚡`) en el pie de cada respuesta del asistente.

### 12. 📥 Exportación Limpia a Markdown (`.md`)
- Botón **Exportar MD** en la barra superior para descargar la transcripción estructurada del chat con un solo click.
- Incluye metadata de fecha, modelo utilizado, workspace, archivos adjuntos analizados, herramientas ejecutadas y estadísticas de tokens.

### 13. 🧩 Visor de MCPs & Plugins
- Pestaña dedicada **MCP** en la navegación lateral que inspecciona los servidores Model Context Protocol configurados (Neon, Stitch, etc.) y los plugins CLI activos (`session-mesh`, `superpowers`, `ecc`).
- Catálogo interactivo de skills disponibles con enlace directo al chat.

---

## 🏗️ Arquitectura del Sistema

```mermaid
flowchart TD
    subgraph UI ["AGY Desktop (Electron + React 19)"]
        ChatView["Chat Interactivo In-App"]
        TelemetryPanel["Panel de Telemetría"]
        LockManager["Gestor de Path Locks"]
        MeshView["Mensajería Inter-Sesión"]
    end

    subgraph IPC ["Canal IPC Seguro (preload.cjs)"]
        startTurn["start-turn / cancel-turn"]
        getTelemetry["get-telemetry"]
        lockPath["lock-path / unlock-path"]
        sendMsg["send-message / broadcast"]
    end

    subgraph Backend ["Electron Main Process (main.cjs)"]
        HeadlessRunner["Spawn agy.exe (windowsHide: true)"]
        MeshBridge["Node Bridge -> session-mesh.cjs"]
    end

    subgraph Core ["Motor Antigravity & Sistema Operativo"]
        AGY["agy.exe CLI Core"]
        WinCred["Windows Credential Manager (gemini:antigravity)"]
        LockRegistry["session_locks.json"]
        PresenceLocks["~/.gemini/antigravity-cli/presence/*.lock"]
        AgentAPI["agy agentapi (Inter-agent IPC)"]
    end

    UI --> IPC
    IPC --> Backend
    HeadlessRunner -->|Stream NDJSON| AGY
    HeadlessRunner --> WinCred
    MeshBridge --> LockRegistry
    MeshBridge --> PresenceLocks
    MeshBridge --> AgentAPI
```

---

## 📦 Instalación y Uso

### Prerrequisitos
- **Windows 10 / 11**
- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Antigravity CLI** instalado y autenticado en tu equipo (`agy`).

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/yogui-dev/agy-desktop.git
cd agy-desktop
pnpm install
```

### 2. Modo Desarrollo
```bash
# Iniciar servidor Vite + ventana Electron con recarga en caliente
pnpm dev
```

### 3. Compilar y Empaquetar
```bash
# Compilar frontend y empaquetar app.asar
pnpm build
```

### 4. Instalador para Windows (.exe)
Puedes generar el binario independiente o instalarlo en tu sistema con un solo clic:

- **Instalación local instantánea:** Ejecuta `install-agy-desktop.cmd` (o `install-agy-desktop.ps1`). Instala la aplicación en `%LOCALAPPDATA%\Programs\AGY Desktop` y crea accesos directos en el Escritorio y Menú Inicio.
- **Compilar paquete portátil:**
  ```bash
  pnpm dist:portable
  ```

---

## 🛠️ Estructura del Proyecto

```
agy-desktop/
├── electron/
│   ├── main.cjs            # Proceso principal: IPC handlers, runner headless de agy.exe
│   └── preload.cjs         # Context bridge seguro para React
├── src/
│   ├── App.jsx             # UI unificada: Chat In-App, Telemetría, Locks y Mesh
│   ├── main.jsx            # Entry point React 19
│   └── index.css           # Estilos Tailwind CSS
├── scripts/
│   └── pack-asar.cjs       # Empaquetado atómico de recursos en app.asar
├── public/
│   └── icon.ico            # Ícono nativo de la aplicación
├── install-agy-desktop.cmd  # Lanzador de instalación rápida para Windows
├── install-agy-desktop.ps1  # Script PowerShell de instalación y accesos directos
├── start-desktop.cmd       # Acceso rápido de ejecución local
└── package.json            # Configuración y scripts pnpm
```

---

## 🔒 Seguridad e Integración con `session-mesh`

El plugin global `session-mesh` (`~/.gemini/config/plugins/session-mesh`) actúa como el guardián de concurrencia:
- **Hook `PreToolUse`:** Intercepta cada llamada a `edit_file` o `write_file`. Si un archivo está bajo un lock activo de otra sesión viva, la operación es abortada automáticamente con un mensaje explicativo.
- **Hook `SessionStart`:** Al abrir cualquier nueva sesión de terminal o interfaz, notifica inmediatamente qué otras sesiones están operando y qué recursos tienen reservados.

---

## 📄 Licencia

MIT © [yogui-dev](https://github.com/yogui-dev)
