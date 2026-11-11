const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');

const USER_HOME = process.env.USERPROFILE || process.env.HOME || '';
const SESSION_MESH_SCRIPT = path.join(USER_HOME, '.gemini', 'config', 'plugins', 'session-mesh', 'scripts', 'session-mesh.cjs');
const AGY_BIN = path.join(process.env.LOCALAPPDATA || '', 'agy', 'bin', 'agy.exe');

let mainWindow = null;
let activeAgentProcess = null;

// Helper: Run session-mesh CLI command safely
function runMeshCommand(command, args = []) {
  if (!fs.existsSync(SESSION_MESH_SCRIPT)) {
    return { error: 'session-mesh script not found' };
  }
  try {
    const stdout = execFileSync('node', [SESSION_MESH_SCRIPT, command, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    });
    return { success: true, output: stdout };
  } catch (err) {
    return { error: err.message, stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

// IPC Handlers: Telemetry & Locks
ipcMain.handle('get-telemetry', async () => {
  const res = runMeshCommand('status', ['--json']);
  if (res.error) return { activeSessionsCount: 0, sessions: [], locks: [] };
  try {
    return JSON.parse(res.output);
  } catch (e) {
    return { activeSessionsCount: 0, sessions: [], locks: [] };
  }
});

ipcMain.handle('get-models', async () => {
  if (!fs.existsSync(AGY_BIN)) return [];
  try {
    const stdout = execFileSync(AGY_BIN, ['models'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 6000
    });
    const lines = stdout.split('\n').filter(l => l.includes('\t'));
    return lines.map(l => {
      const [id, name] = l.split('\t');
      return { id: id.trim(), name: (name || id).trim() };
    });
  } catch (e) {
    return [
      { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' }
    ];
  }
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

// IPC Handler: Embedded In-App Turn Execution (Zero External Windows)
ipcMain.handle('start-turn', async (event, { prompt, model, conversationId, workspace }) => {
  if (!fs.existsSync(AGY_BIN)) return { error: 'agy.exe no encontrado en el sistema' };

  if (activeAgentProcess) {
    try { activeAgentProcess.kill(); } catch (e) {}
    activeAgentProcess = null;
  }

  const workspaceDir = workspace || 'C:\\Proyectos\\yoguidev';
  const args = ['-p', prompt, '--output-format', 'stream-json', '--dangerously-skip-permissions'];
  if (model) args.push('--model', model);
  if (conversationId) args.push('--conversation', conversationId);

  try {
    activeAgentProcess = spawn(AGY_BIN, args, {
      cwd: workspaceDir,
      windowsHide: true, // Invisible, zero external terminal windows!
      env: process.env
    });

    let buffer = '';

    activeAgentProcess.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep trailing incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-event', parsed);
          }
        } catch (e) {
          // Plain log line
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-event', { event: 'log', text: trimmed });
          }
        }
      }
    });

    activeAgentProcess.stderr.on('data', chunk => {
      const errText = chunk.toString('utf8').trim();
      if (errText && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-event', { event: 'stderr', text: errText });
      }
    });

    activeAgentProcess.on('close', code => {
      activeAgentProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('turn-finished', { code });
      }
    });

    activeAgentProcess.on('error', err => {
      activeAgentProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream-event', { event: 'error', error: err.message });
        mainWindow.webContents.send('turn-finished', { code: 1, error: err.message });
      }
    });

    return { success: true };
  } catch (err) {
    activeAgentProcess = null;
    return { error: err.message };
  }
});

ipcMain.handle('cancel-turn', async () => {
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    title: 'AGY Desktop — Control Plane'
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
