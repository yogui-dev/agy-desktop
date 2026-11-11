# 🛸 AGY Desktop — Antigravity Embedded Control Plane

**AGY Desktop** es una aplicación nativa de escritorio para Windows diseñada para orquestar, supervisar y controlar agentes de **Antigravity CLI** en tiempo real. 

Toda la interacción con el modelo y la ejecución de herramientas corre de manera **embebida dentro de la aplicación**, eliminando la apertura de ventanas de terminal externas y permitiendo trabajar con múltiples sesiones concurrentes sin colisiones de código ni sobreescrituras accidentales.

---

## 📸 Características Principales

### 1. 💬 Agente Interactivo Embebido (Zero External Windows)
- **Ejecución 100% In-App:** Las instrucciones se procesan en segundo plano (`windowsHide: true`) con el binario nativo de Antigravity CLI.
- **Streaming NDJSON en Vivo:** Visualización en tiempo real del flujo de pensamiento (*thinking*), generación de respuestas token por token y estado de herramientas (`ACTIVE`, `DONE`, `ERROR`).
- **Control de Turnos:** Botón para interrumpir o detener la ejecución en cualquier momento (`cancelTurn`).
- **Selector Dinámico de Modelos:** Alterna al instante entre modelos como `Gemini 3.8 Flash (High)`, `Claude Sonnet 4.6 (Thinking)`, y los demás modelos disponibles en tu entorno CLI.

### 2. 🔐 Autenticación Heredada (Zero-Auth Friction)
- Hereda directamente las credenciales almacenadas en el Administrador de Credenciales de Windows (`gemini:antigravity`).
- No requiere claves API manuales, tokens en `.env` ni inicios de sesión repetitivos.
- Mantiene acceso a los mismos plugins, hooks y servidores MCP configurados en tu máquina.

### 3. 🌐 Mission Control & Telemetría en Vivo (`session-mesh`)
- **Detección Determinista de Sesiones Vivas:** Utiliza el mecanismo de exclusión mutua de archivos (`EBUSY` sobre handles de `presence/<convId>.lock`), reportando con precisión cero-costo qué sesiones siguen activas y cuáles han cerrado.
- **Monitoreo en Tiempo Real:** Inspecciona la última consulta del usuario, el pensamiento del modelo y las tareas asíncronas en ejecución en cada sesión paralela.
- **Transición Fluida:** Haz clic en cualquier sesión detectada para inspeccionarla o continuar su contexto directamente desde el chat de AGY Desktop.

### 4. 🛡️ Gestor Visual de Bloqueos (Path Locking)
- **Prevención de Condiciones de Carrera:** Reserva archivos o carpetas críticas (ej. `cerebro-digital/`, `src/api/`) para que otra sesión no modifique los mismos archivos en paralelo.
- **Guardián PreToolUse:** El hook de `session-mesh` intercepta las llamadas a `edit_file` y `write_file` de cualquier sesión y bloquea escrituras en rutas reservadas por otra sesión activa.
- **Liberación Inmediata:** Libera locks con 1 clic desde la pestaña **Locks**.

### 5. 📻 Tablón de Mensajes Inter-Agente (Mesh Chat)
- Envía mensajes reactivos directos a otra sesión de Antigravity CLI mediante la API de mensajería interna.
- Realiza transmisiones masivas (*broadcast*) que notifican a todos los agentes que estén trabajando en el mismo workspace.

---

## 🏗️ Arquitectura Técnica

```
┌───────────────────────────────────────────────────────────┐
│                       AGY Desktop                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │   Vite + React 19 + Tailwind CSS + Lucide Icons     │  │
│  │   (Chat Embebido, Dashboard, Locks, Mesh)           │  │
│  └──────────────────────────┬──────────────────────────┘  │
│                             │ IPC Bridge (contextBridge)   │
│  ┌──────────────────────────▼──────────────────────────┐  │
│  │           Electron Main Process (Node.js)           │  │
│  │    • spawn agy.exe (-p, --output-format stream-json)│  │
│  │    • session-mesh.cjs (telemetría y bloqueos)       │  │
│  └──────────────────────────┬──────────────────────────┘  │
└─────────────────────────────┼─────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌───────────────────────────┐           ┌───────────────────┐
│     Antigravity CLI       │           │   Session Mesh    │
│  • Token Streaming        │           │ • Lock Guard Hook │
│  • Tool Executions        │           │ • EBUSY Detector  │
│  • Windows Credential     │           │ • Reactive Relay  │
└───────────────────────────┘           └───────────────────┘
```

---

## 📦 Instalación y Uso en Windows

### Requisitos Previos
- **Windows 10/11** (64-bit)
- **Node.js 18+** y **pnpm** (`npm install -g pnpm`)
- **Antigravity CLI** instalado y autenticado en tu equipo (`agy.exe`).

### Instalación con Acceso Directo (Recomendado)
El proyecto incluye un instalador automático para Windows que compila, empaqueta y registra la aplicación en el **Menú Inicio** y en el **Escritorio**:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/yogui-dev/agy-desktop.git
   cd agy-desktop
   ```
2. Instala dependencias:
   ```bash
   pnpm install
   ```
3. Ejecuta el script de instalación:
   - Haz doble clic en `install-agy-desktop.cmd`, o ejecuta en PowerShell:
     ```powershell
     .\install-agy-desktop.ps1
     ```

La aplicación se instalará en:
```
%LOCALAPPDATA%\Programs\AGY Desktop\
```
Y generará accesos directos automáticos:
- `Escritorio\AGY Desktop.lnk`
- `Menú Inicio\Programas\AGY Desktop.lnk`

### Desinstalación
Si deseas remover la aplicación instalada, ejecuta:
```cmd
"%LOCALAPPDATA%\Programs\AGY Desktop\uninstall.cmd"
```
O elimina la carpeta en `%LOCALAPPDATA%\Programs\AGY Desktop` y sus accesos directos.

---

## 🛠️ Desarrollo Local

```bash
# Iniciar frontend con Vite + Electron con recarga en vivo (HMR)
pnpm dev

# Iniciar únicamente la ventana Electron apuntando al build
pnpm dev:electron
# o mediante el lanzador rápido:
start-desktop.cmd

# Compilar UI y generar app.asar optimizado (~300 KB)
pnpm build
```

---

## 🗂️ Estructura del Proyecto

```
agy-desktop/
├── electron/
│   ├── main.cjs            # Proceso principal: runner embebido de agy.exe y puente session-mesh
│   └── preload.cjs         # ContextBridge seguro hacia el renderer
├── public/
│   └── icon.ico            # Ícono de la aplicación
├── scripts/
│   └── pack-asar.cjs       # Empaquetador automatizado de app.asar ultra-ligero
├── src/
│   ├── App.jsx             # Interfaz completa: Chat, Panel, Locks y Mesh
│   ├── main.jsx            # Punto de entrada de React 19
│   └── index.css           # Estilos base y utilidades Tailwind CSS
├── install-agy-desktop.cmd # Instalador 1-click para Windows
├── install-agy-desktop.ps1 # Lógica PowerShell de instalación y accesos directos
├── start-desktop.cmd       # Acceso rápido en desarrollo
├── package.json
└── README.md
```

---

## 📄 Licencia

Proyecto personal desarrollado por [yogui-dev](https://github.com/yogui-dev). Licencia MIT.
