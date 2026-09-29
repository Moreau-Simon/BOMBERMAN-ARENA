/**
 * @module ClientMain
 * @description Process principal Electron.
 * Crée la fenêtre de l'application et charge le renderer.
 *
 * Electron fonctionne avec 2 processes :
 * - Main (ce fichier) : accès Node.js complet
 * - Renderer (index.html + scripts) : contexte navigateur
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 720,
    resizable: false,
    title: 'Bomberman Arena',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Masquer la barre de menu pour un rendu plus propre
  mainWindow.setMenuBarVisibility(false);
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
