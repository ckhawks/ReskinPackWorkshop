import { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut } from "electron";
import * as path from "path";
import { ReskinType } from "../types";
import { detectGameFolder, isValidGameFolder, getReskinpacksFolder } from "../utils/gameDetection";
import { listReskinPacks, readReskinPack, createNewReskinPack, copyImageToPack, deleteReskinPack, writeReskinPack, generateUniqueId } from "../utils/fileOps";
import { loadConfig, saveConfig } from "../utils/config";
import { validateImageFile } from "../utils/imageValidation";
import { checkForUpdates } from "../utils/updateChecker";
import { RESKIN_TYPE_FOLDERS } from "../utils/constants";
import { scanWorkshopMods, getWorkshopModPath } from "../utils/workshopScanning";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Remove the menu bar
  Menu.setApplicationMenu(null);

  // Register keyboard shortcut to toggle dev tools even without menu
  globalShortcut.register("CmdOrCtrl+Shift+I", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  const isDev = process.env.NODE_ENV === "development";
  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../renderer/index.html")}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

ipcMain.handle("get-config", () => {
  return loadConfig();
});

ipcMain.handle("save-config", (_, config) => {
  return saveConfig(config);
});

ipcMain.handle("detect-game-folder", async () => {
  const detected = await detectGameFolder();
  return detected;
});

ipcMain.handle("validate-game-folder", (_, folderPath) => {
  return isValidGameFolder(folderPath);
});

ipcMain.handle("select-game-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });

  if (result.canceled) {
    return null;
  }

  const folderPath = result.filePaths[0];
  if (isValidGameFolder(folderPath)) {
    return folderPath;
  }

  return null;
});

ipcMain.handle("list-reskin-packs", (_, gameFolder) => {
  const reskinpacksFolder = getReskinpacksFolder(gameFolder);
  return listReskinPacks(reskinpacksFolder);
});

ipcMain.handle("read-reskin-pack", (_, gameFolder, packName) => {
  const packPath = path.join(getReskinpacksFolder(gameFolder), packName);
  return readReskinPack(packPath);
});

ipcMain.handle("create-reskin-pack", (_, gameFolder, packName) => {
  const reskinpacksFolder = getReskinpacksFolder(gameFolder);
  const packPath = path.join(reskinpacksFolder, packName);
  const uniqueId = generateUniqueId(packName);
  const pack = createNewReskinPack(packName, uniqueId, packPath);
  return pack;
});

ipcMain.handle("save-reskin-pack", (_, gameFolder, packName, pack) => {
  const packPath = path.join(getReskinpacksFolder(gameFolder), packName);
  return writeReskinPack(packPath, pack);
});

ipcMain.handle("delete-reskin-pack", (_, gameFolder, packName) => {
  const packPath = path.join(getReskinpacksFolder(gameFolder), packName);
  return deleteReskinPack(packPath);
});

ipcMain.handle("select-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [
      { name: "Images", extensions: ["png"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("validate-image", async (_, imagePath) => {
  return validateImageFile(imagePath);
});

ipcMain.handle("copy-image-to-pack", (_, gameFolder, packName, sourceImagePath, reskinType: ReskinType, imageName) => {
  const packPath = path.join(getReskinpacksFolder(gameFolder), packName);
  const destFolder = RESKIN_TYPE_FOLDERS[reskinType];
  const destRelativePath = path.join(destFolder, imageName);
  return copyImageToPack(sourceImagePath, packPath, destRelativePath);
});

ipcMain.handle("check-for-updates", async () => {
  return checkForUpdates();
});

ipcMain.handle("open-external-url", async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error("Failed to open URL:", error);
    return false;
  }
});

ipcMain.handle("open-folder", async (_, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error("Failed to open folder:", error);
    return false;
  }
});

ipcMain.handle("open-file", async (_, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    console.error("Failed to open file:", error);
    return false;
  }
});

ipcMain.handle("open-with-app", async (_, filePath: string) => {
  try {
    // On Windows, shell.openPath opens with the default app associated with the file type
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    console.error("Failed to open file with app:", error);
    return false;
  }
});

ipcMain.handle("open-with-dialog", async (_, filePath: string) => {
  try {
    const { spawn } = require("child_process");
    const fs = require("fs");

    // Normalize the path (convert forward slashes to backslashes)
    const normalizedPath = filePath.replace(/\//g, "\\");

    // Verify the file exists before trying to open it
    if (!fs.existsSync(normalizedPath)) {
      console.error("File not found:", normalizedPath);
      return false;
    }

    // Use Windows "Open with..." dialog
    spawn("rundll32.exe", ["shell32.dll,OpenAs_RunDLL", normalizedPath], {
      shell: true
    });

    console.log("Opened 'Open with' dialog for:", normalizedPath);
    return true;
  } catch (error) {
    console.error("Failed to open with dialog:", error);
    return false;
  }
});

ipcMain.handle("read-image-as-data-url", async (_, imagePath: string) => {
  try {
    const fs = require("fs");
    if (!fs.existsSync(imagePath)) {
      return null;
    }
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("Error reading image:", error);
    return null;
  }
});

ipcMain.handle("save-dropped-file", async (_, fileName: string, base64Data: string) => {
  try {
    const fs = require("fs");
    const os = require("os");
    const tempDir = path.join(os.tmpdir(), "reskin-helper");

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save the file to temp directory
    const tempFilePath = path.join(tempDir, fileName);
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(tempFilePath, buffer);

    return tempFilePath;
  } catch (error) {
    console.error("Error saving dropped file:", error);
    return null;
  }
});

ipcMain.handle("scan-workshop-mods", async (_, gameFolder: string) => {
  try {
    return scanWorkshopMods(gameFolder);
  } catch (error) {
    console.error("Error scanning workshop mods:", error);
    return [];
  }
});

ipcMain.handle("get-workshop-mod-path", async (_, workshopId: string, gameFolder: string) => {
  return getWorkshopModPath(workshopId, gameFolder);
});

ipcMain.handle("read-workshop-reskin-pack", async (_, workshopId: string, gameFolder: string) => {
  try {
    const modPath = getWorkshopModPath(workshopId, gameFolder);
    if (!modPath) {
      return null;
    }

    const fs = require("fs");
    const reskinPackPath = path.join(modPath, "reskinpack.json");
    if (!fs.existsSync(reskinPackPath)) {
      return null;
    }

    const data = fs.readFileSync(reskinPackPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading workshop reskin pack:", error);
    return null;
  }
});
