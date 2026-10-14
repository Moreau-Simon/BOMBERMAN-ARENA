/**
 * @module ClientMain
 * @description Process principal Electron.
 * Crée la fenêtre de l'application et charge le renderer.
 *
 * Electron fonctionne avec 2 processes :
 * - Main (ce fichier) : accès Node.js complet
 * - Renderer (index.html + scripts) : contexte navigateur
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';



const assetsDir = path.resolve(__dirname, '..', '..', '..', 'assets');
try {
  const jpgPath = path.join(assetsDir, 'menu_bg.jpg');
  const pngPath = path.join(assetsDir, 'menu_bg.png');
  if (fs.existsSync(jpgPath) && !fs.existsSync(pngPath)) {
    fs.copyFileSync(jpgPath, pngPath);
  }
} catch (e) {}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 720,
    resizable: true,
    title: 'Bomberman Arena',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  // Forward renderer console messages to the main process (terminal)
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Masquer la barre de menu pour un rendu plus propre
  mainWindow.setMenuBarVisibility(false);

  // ── IPC Handlers ──────────────────────────────────────────────────
  ipcMain.on('window:toggle_fullscreen', () => {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
  });

  ipcMain.handle('window:is_fullscreen', () => {
    return mainWindow.isFullScreen();
  });

  ipcMain.on('app:quit', () => {
    app.quit();
  });
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
