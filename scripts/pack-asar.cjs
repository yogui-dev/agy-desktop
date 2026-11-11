const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const stageDir = path.join(rootDir, '.app-build');
  const asarOut = path.join(rootDir, 'release', 'win-unpacked', 'resources', 'app.asar');
  const installedAsar = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AGY Desktop', 'resources', 'app.asar');

  console.log('[pack-asar] Preparando staging para app.asar...');
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(stageDir, 'package.json'));

  function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDir(path.join(rootDir, 'dist'), path.join(stageDir, 'dist'));
  copyDir(path.join(rootDir, 'electron'), path.join(stageDir, 'electron'));
  copyDir(path.join(rootDir, 'public'), path.join(stageDir, 'public'));

  fs.mkdirSync(path.dirname(asarOut), { recursive: true });

  console.log('[pack-asar] Empaquetando asar con @electron/asar...');
  try {
    await asar.createPackage(stageDir, asarOut);
    console.log(`[pack-asar] Generado exitosamente: ${asarOut}`);

    if (fs.existsSync(path.dirname(installedAsar))) {
      try {
        fs.copyFileSync(asarOut, installedAsar);
        console.log(`[pack-asar] Actualizada instalación local en: ${installedAsar}`);
      } catch (copyErr) {
        console.warn(`[pack-asar] Nota: No se pudo sobrescribir la app instalada (¿está abierta?):`, copyErr.message);
      }
    }
  } finally {
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }
}

main().catch(err => {
  console.error('[pack-asar] Error fatal:', err);
  process.exit(1);
});
