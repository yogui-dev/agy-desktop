const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, execFile, spawn } = require('child_process');

const USER_HOME = process.env.USERPROFILE || process.env.HOME || '';
const SESSION_MESH_SCRIPT = path.join(USER_HOME, '.gemini', 'config', 'plugins', 'session-mesh', 'scripts', 'session-mesh.cjs');
const AGY_BIN = path.join(process.env.LOCALAPPDATA || '', 'agy', 'bin', 'agy.exe');

// Runtime debug logger
const LOG_FILE = path.join(USER_HOME, '.gemini', 'agy-desktop-runtime.log');
function logRuntime(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {}
}
logRuntime('--- AGY Desktop Process Started ---');

process.on('uncaughtException', (err) => {
  logRuntime(`[UncaughtException] ${err.stack || err}`);
  console.error('[UncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  logRuntime(`[UnhandledRejection] ${reason}`);
  console.error('[UnhandledRejection]', reason);
});

let mainWindow = null;
let activeAgentProcess = null;
let tray = null;
let isQuitting = false;

function getAppIcon() {
  const possiblePaths = [
    path.join(__dirname, '..', 'dist', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico')
  ];
  for (const iconPath of possiblePaths) {
    try {
      if (fs.existsSync(iconPath)) {
        const buf = fs.readFileSync(iconPath);
        const img = nativeImage.createFromBuffer(buf);
        if (!img.isEmpty()) return img;
      }
    } catch (e) {}
  }
  return null;
}

// Helper: Run session-mesh CLI command safely (Non-blocking async)
function runMeshCommand(command, args = []) {
  return new Promise((resolve) => {
    if (!fs.existsSync(SESSION_MESH_SCRIPT)) {
      return resolve({ error: 'session-mesh script not found' });
    }
    execFile('node', [SESSION_MESH_SCRIPT, command, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ error: err.message, stderr: stderr || '' });
      }
      resolve({ success: true, output: stdout });
    });
  });
}

// IPC Handlers: Telemetry & Locks
ipcMain.handle('get-telemetry', async () => {
  const res = await runMeshCommand('status', ['--json']);
  if (res.error) return { activeSessionsCount: 0, sessions: [], locks: [] };
  try {
    return JSON.parse(res.output);
  } catch (e) {
    return { activeSessionsCount: 0, sessions: [], locks: [] };
  }
});

ipcMain.handle('get-models', () => {
  return new Promise((resolve) => {
    if (!fs.existsSync(AGY_BIN)) return resolve([]);
    execFile(AGY_BIN, ['models'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 6000
    }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([
          { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' }
        ]);
      }
      const lines = stdout.split('\n').filter(l => l.includes('\t'));
      resolve(lines.map(l => {
        const [id, name] = l.split('\t');
        return { id: id.trim(), name: (name || id).trim() };
      }));
    });
  });
});

ipcMain.handle('lock-path', async (_, { targetPath, reason, convId }) => {
  const args = [targetPath, reason || 'Trabajo desde AGY Desktop'];
  if (convId) args.push(`--conv=${convId}`);
  return runMeshCommand('lock', args);
});

ipcMain.handle('unlock-path', async (_, { targetPath, convId }) => {
  const args = [targetPath];
  if (convId) args.push(`--conv=${convId}`);
  return runMeshCommand('unlock', args);
});

ipcMain.handle('send-message', async (_, { recipientId, message }) => {
  return runMeshCommand('msg', [recipientId, message]);
});

ipcMain.handle('broadcast-message', async (_, { message, senderId }) => {
  const args = [message];
  if (senderId) args.push(`--conv=${senderId}`);
  return runMeshCommand('broadcast', args);
});

// Helper: Ensure OpenAI API Key is available
function getOpenAIApiKey() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }
  try {
    const stdout = execFileSync('powershell', ['-NoProfile', '-Command', '[Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User")'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000
    });
    if (stdout && stdout.trim()) {
      process.env.OPENAI_API_KEY = stdout.trim();
      return process.env.OPENAI_API_KEY;
    }
  } catch (e) {}
  return '';
}

const WHISPER_VOCAB_BIAS = "Antigravity, CLI, Git, Electron, Vite, React, Windows, terminal, código, repositorio, branch, commit, push, pnpm, build, bug, fix, deploy";

async function transcribeAudioPayload(audioBytes, mimeType = 'audio/webm') {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return { error: 'OPENAI_API_KEY no encontrada en las variables de entorno de Windows.' };
  }

  try {
    const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('m4a') ? 'm4a' : 'webm';
    const blob = new Blob([audioBytes], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('prompt', WHISPER_VOCAB_BIAS);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Whisper error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    return { success: true, text: data.text ? data.text.trim() : '', duration: data.usage?.seconds };
  } catch (err) {
    return { error: `Error transcribiendo audio: ${err.message}` };
  }
}

ipcMain.handle('transcribe-audio', async (_, { audioBuffer, mimeType }) => {
  if (!audioBuffer) return { error: 'Buffer de audio no provisto' };
  const bytes = Buffer.from(audioBuffer);
  return transcribeAudioPayload(bytes, mimeType);
});

ipcMain.handle('select-audio-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo de audio para transcribir',
    filters: [
      { name: 'Archivos de Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac', 'flac'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return { canceled: true };

  const filePath = result.filePaths[0];
  try {
    const fileBytes = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mp3' : ext === 'ogg' ? 'audio/ogg' : 'audio/webm';
    const res = await transcribeAudioPayload(fileBytes, mime);
    return { ...res, fileName: path.basename(filePath) };
  } catch (err) {
    return { error: `Error leyendo archivo de audio: ${err.message}` };
  }
});

// Synthesize speech with edge-tts (Chilean Catalina)
ipcMain.handle('speak-text', async (_, { text }) => {
  if (!text) return { error: 'Texto vacío' };
  const cleanText = text.replace(/[`"'\\]/g, ' ').replace(/\n+/g, ' ').slice(0, 1500).trim();
  const tempOut = path.join(os.tmpdir(), `agy_speak_${Date.now()}.mp3`);
  
  const pyScript = `import edge_tts, asyncio; asyncio.run(edge_tts.Communicate('''${cleanText}''', 'es-CL-CatalinaNeural', pitch='-10Hz', rate='-4%').save('${tempOut.replace(/\\/g, '\\\\')}'))`;
  
  try {
    execFileSync('python', ['-c', pyScript], { windowsHide: true, timeout: 15000 });
    if (fs.existsSync(tempOut)) {
      const audioBytes = fs.readFileSync(tempOut);
      fs.unlinkSync(tempOut);
      return { success: true, audioBase64: audioBytes.toString('base64') };
    }
    return { error: 'No se generó el archivo de audio' };
  } catch (err) {
    return { error: err.message };
  }
});

// General File Selection and Metadata Handlers
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivos para adjuntar al chat',
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  return result.filePaths.map(filePath => {
    try {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        ext: path.extname(filePath).toLowerCase().replace('.', '')
      };
    } catch (e) {
      return {
        path: filePath,
        name: path.basename(filePath),
        size: 0,
        ext: path.extname(filePath).toLowerCase().replace('.', '')
      };
    }
  });
});

ipcMain.handle('get-file-info', async (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      ext: path.extname(filePath).toLowerCase().replace('.', '')
    };
  } catch (e) {
    return null;
  }
});

// Workspace & Project Management Handlers
ipcMain.handle('select-workspace-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar Carpeta de Workspace / Proyecto',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-common-workspaces', async () => {
  const userProjectsDir = path.join(USER_HOME, 'Projects');
  const yoguiWorkspace = 'C:\\Proyectos\\yoguidev';
  const baseDir = process.env.AGY_DEFAULT_WORKSPACE ||
    (fs.existsSync(yoguiWorkspace) ? yoguiWorkspace : null) ||
    (fs.existsSync(userProjectsDir) ? userProjectsDir : null) ||
    (fs.existsSync(path.join(USER_HOME, 'Documents')) ? path.join(USER_HOME, 'Documents') : USER_HOME);

  const baseName = path.basename(baseDir) || 'Workspace';
  const workspaces = [{ path: baseDir, name: `${baseName} (Root)` }];
  try {
    if (fs.existsSync(baseDir)) {
      const items = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          workspaces.push({
            path: path.join(baseDir, item.name),
            name: item.name
          });
        }
      }
    }
  } catch (e) {}
  return workspaces;
});

// MCP & Plugins Inspection
ipcMain.handle('get-mcp-status', () => {
  return new Promise((resolve) => {
    if (!fs.existsSync(AGY_BIN)) return resolve([]);
    execFile(AGY_BIN, ['mcp', 'list'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const agyMcpList = [];
      stdout.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('Available') && !trimmed.startsWith('---')) {
          agyMcpList.push(trimmed);
        }
      });
      resolve(agyMcpList);
    });
  });
});

ipcMain.handle('get-plugins-status', () => {
  return new Promise((resolve) => {
    if (!fs.existsSync(AGY_BIN)) return resolve([]);
    execFile(AGY_BIN, ['plugins', 'list'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const plugins = [];
      stdout.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed) plugins.push(trimmed);
      });
      resolve(plugins);
    });
  });
});

ipcMain.handle('show-notification', async (_, { title, body }) => {
  if (Notification.isSupported()) {
    const icon = getAppIcon();
    new Notification({
      title: title || 'AGY Desktop',
      body: body || '',
      icon: (icon && !icon.isEmpty()) ? icon : undefined
    }).show();
    return true;
  }
  return false;
});

// Auto-failover utilities for multi-account
const QUOTA_ERROR_PATTERNS = [
  'resource_exhausted',
  'quota exceeded',
  'exhausted your capacity',
  '429 too many requests',
  'rate limit reached',
  'rate_limit_exceeded',
  'resource has been exhausted',
  'too many requests'
];

function isQuotaError(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return QUOTA_ERROR_PATTERNS.some(p => lower.includes(p));
}

function rotateAccount() {
  return new Promise((resolve) => {
    const agyAccountScript = path.join(path.dirname(AGY_BIN), 'agy-account.py');
    if (!fs.existsSync(agyAccountScript)) {
      console.warn('[Auto-Failover] agy-account.py no encontrado');
      return resolve(null);
    }
    execFile('python', [agyAccountScript, 'rotate'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) {
        console.error('[Auto-Failover] Error rotando cuenta:', err.message);
        return resolve(null);
      }
      const match = (stdout || '').match(/Conmutado exitosamente a perfil '([^']+)'/i) ||
                    (stdout || '').match(/Cuenta activa:\s*([^\s]+)/i);
      const newAcc = match ? match[1] : 'siguiente cuenta';
      console.log(`[Auto-Failover] Conmutado exitosamente a: ${newAcc}`);
      resolve(newAcc);
    });
  });
}

let isTurnCancelled = false;

// IPC Handler: Embedded In-App Turn Execution (Zero External Windows) with Multi-Account Auto-Failover
ipcMain.handle('start-turn', async (event, { prompt, model, conversationId, workspace }) => {
  if (!fs.existsSync(AGY_BIN)) return { error: 'agy.exe no encontrado en el sistema' };

  if (activeAgentProcess) {
    try { activeAgentProcess.kill(); } catch (e) {}
    activeAgentProcess = null;
  }

  isTurnCancelled = false;
  const defaultWorkspace = process.env.AGY_DEFAULT_WORKSPACE ||
    (fs.existsSync('C:\\Proyectos\\yoguidev') ? 'C:\\Proyectos\\yoguidev' : null) ||
    USER_HOME;
  const workspaceDir = workspace || defaultWorkspace;

  let currentConvId = conversationId;
  const maxAttempts = 3;

  const runAttempt = (attempt) => {
    return new Promise((resolve) => {
      if (isTurnCancelled) {
        return resolve({ cancelled: true });
      }

      const args = ['-p', prompt, '--output-format', 'stream-json', '--dangerously-skip-permissions'];
      if (model) args.push('--model', model);
      if (currentConvId && !currentConvId.startsWith('conv-') && currentConvId !== 'draft') {
        args.push('--conversation', currentConvId);
      }

      let detectedQuota = false;
      let buffer = '';

      try {
        activeAgentProcess = spawn(AGY_BIN, args, {
          cwd: workspaceDir,
          windowsHide: true, // Invisible, zero external terminal windows!
          env: process.env
        });

        activeAgentProcess.stdout.on('data', chunk => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep trailing incomplete line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.conversation_id) {
                currentConvId = parsed.conversation_id;
              }
              if (parsed.status === 'ERROR' || parsed.error || (parsed.result && parsed.result.status === 'ERROR')) {
                if (isQuotaError(JSON.stringify(parsed))) {
                  detectedQuota = true;
                }
              }
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('stream-event', parsed);
              }
            } catch (e) {
              if (isQuotaError(trimmed)) {
                detectedQuota = true;
              }
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('stream-event', { event: 'log', text: trimmed });
              }
            }
          }
        });

        activeAgentProcess.stderr.on('data', chunk => {
          const errText = chunk.toString('utf8').trim();
          if (errText) {
            if (isQuotaError(errText)) {
              detectedQuota = true;
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('stream-event', { event: 'stderr', text: errText });
            }
          }
        });

        activeAgentProcess.on('close', async code => {
          activeAgentProcess = null;

          if (isTurnCancelled) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('turn-finished', { code: 1, cancelled: true });
            }
            return resolve({ cancelled: true });
          }

          // Auto-Failover: Si detectamos límite de cuota y aún nos quedan intentos con otras cuentas
          if (detectedQuota && attempt < maxAttempts) {
            console.warn(`[Auto-Failover] Límite de cuota detectado (intento ${attempt}/${maxAttempts}). Conmutando cuenta...`);
            const nextAccount = await rotateAccount();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('stream-event', {
                event: 'quota-failover',
                attempt,
                maxAttempts,
                nextAccount: nextAccount || 'cuenta siguiente'
              });
            }
            await new Promise(r => setTimeout(r, 600));
            return resolve(await runAttempt(attempt + 1));
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('turn-finished', { code });
          }
          if (Notification.isSupported() && (!mainWindow || !mainWindow.isFocused() || !mainWindow.isVisible())) {
            try {
              const icon = getAppIcon();
              new Notification({
                title: '🛸 AGY Desktop',
                body: code === 0 ? 'Turno completado exitosamente.' : 'El turno terminó con advertencias o errores.',
                icon: (icon && !icon.isEmpty()) ? icon : undefined
              }).show();
            } catch (e) {}
          }
          resolve({ success: code === 0 });
        });

        activeAgentProcess.on('error', err => {
          activeAgentProcess = null;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-event', { event: 'error', error: err.message });
            mainWindow.webContents.send('turn-finished', { code: 1, error: err.message });
          }
          resolve({ error: err.message });
        });

      } catch (err) {
        activeAgentProcess = null;
        resolve({ error: err.message });
      }
    });
  };

  runAttempt(1);
  return { success: true };
});

ipcMain.handle('cancel-turn', async () => {
  isTurnCancelled = true;
  if (activeAgentProcess) {
    try {
      activeAgentProcess.kill();
      activeAgentProcess = null;
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }
  return { success: true };
});

function createTray() {
  try {
    const icon = getAppIcon();
    if (!icon || icon.isEmpty()) return;
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir AGY Desktop',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Ocultar a la bandeja',
        click: () => {
          if (mainWindow) mainWindow.hide();
        }
      },
      { type: 'separator' },
      {
        label: 'Salir completamente',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('AGY Desktop — Control Plane (Ctrl+Shift+Espacio)');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.error('Tray creation error:', err);
  }
}

function createWindow() {
  const appIcon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: true,
    backgroundColor: '#0d1117',
    icon: (appIcon && !appIcon.isEmpty()) ? appIcon : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    title: 'AGY Desktop — Control Plane'
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logRuntime(`[Renderer Console] [Level ${level}] ${message} (${sourceId}:${line})`);
    console.log(`[Renderer Console] [Level ${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (event, detailed) => {
    logRuntime(`[RenderGone] ${JSON.stringify(detailed)}`);
    console.error('Render process gone:', detailed);
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logRuntime(`[FailedLoad] code=${errorCode} desc=${errorDescription}`);
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    logRuntime('[ready-to-show] Window ready, showing and focusing');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    logRuntime(`[createWindow] Loading devUrl: ${devUrl}`);
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    logRuntime(`[createWindow] Loading file: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  // Ensure window is always visible
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logRuntime('[createWindow] Forcing window show from fallback timeout');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1000);

  mainWindow.on('close', (event) => {
    logRuntime(`[mainWindow.on('close')] isQuitting=${isQuitting}`);
  });

  mainWindow.on('closed', () => {
    logRuntime('[mainWindow.on("closed")] Window destroyed');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logRuntime('[app.whenReady] Initializing window & tray');
  createWindow();
  createTray();

  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (e) {
    console.error('Failed to register global shortcut:', e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  logRuntime('[app.on("will-quit")] Application quitting');
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  logRuntime('[app.on("window-all-closed")] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
