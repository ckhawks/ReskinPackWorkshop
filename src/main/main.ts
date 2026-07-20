import { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut, screen } from "electron";
import * as path from "path";
import { ReskinType } from "../types";
import { detectGameFolder, isValidGameFolder, getReskinpacksFolder } from "../utils/gameDetection";
import { listReskinPacks, readReskinPack, createNewReskinPack, copyImageToPack, deleteReskinPack, writeReskinPack, generateUniqueId, listContentFiles } from "../utils/fileOps";
import { loadConfig, saveConfig } from "../utils/config";
import { validateImageFile } from "../utils/imageValidation";
import { checkForUpdates } from "../utils/updateChecker";
import { RESKIN_TYPE_FOLDERS } from "../utils/constants";
import { scanWorkshopMods, getWorkshopModPath } from "../utils/workshopScanning";
import {
  getSteamStatus,
  detectPuckBuildId,
  validatePreviewImage,
  recompressPreviewImage,
  getLiveMetadata,
  listMyPublishedItems,
} from "../utils/steamWorkshop";
import {
  listWorkshopItems,
  getWorkshopItemForPack,
  upsertWorkshopItem,
  deleteWorkshopItem,
  storePreview,
  previewDestFor,
} from "../utils/workshopItems";
import { publishWorkshopItem, PublishRequest, syncAllFromSteam } from "../utils/publishFlow";
import { importFromSteamWorkshopUploader } from "../utils/swuImport";
import { WorkshopItemRecord } from "../types";

/** Turn an arbitrary seed into a filesystem-safe key for preview filenames. */
function safePreviewKey(seed: string): string {
  return (
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "preview"
  );
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Default to 1.5x the old size, but never larger than the usable screen area.
  const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.min(1800, workW);
  const winHeight = Math.min(1200, workH);

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
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

ipcMain.handle("get-app-version", () => {
  // app.getVersion() returns Electron's version in dev (when launched via a
  // path), so read our real version straight from package.json. This resolves
  // correctly both in dev (project root) and when packaged (asar root).
  try {
    const fs = require("fs");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")
    );
    return pkg.version || app.getVersion();
  } catch {
    return app.getVersion();
  }
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

ipcMain.handle("validate-image", async (_, imagePath, reskinType?: ReskinType) => {
  return validateImageFile(imagePath, reskinType);
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

ipcMain.handle("scan-workshop-mods", (_, gameFolder: string) => {
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

ipcMain.handle("replace-image", async (_, destPath: string, sourceImagePath: string) => {
  try {
    const fs = require("fs");

    // Normalize paths
    const normalizedDest = destPath.replace(/\//g, path.sep);
    const normalizedSource = sourceImagePath.replace(/\//g, path.sep);

    // Verify source exists
    if (!fs.existsSync(normalizedSource)) {
      return { success: false, error: "Source image not found" };
    }

    // Copy the source to destination, overwriting if exists
    fs.copyFileSync(normalizedSource, normalizedDest);

    return { success: true };
  } catch (error) {
    console.error("Error replacing image:", error);
    return { success: false, error: String(error) };
  }
});

// -------------------------------------------------------------------------
// Steam Workshop publishing
// -------------------------------------------------------------------------

ipcMain.handle("workshop-get-steam-status", () => {
  return getSteamStatus();
});

ipcMain.handle("workshop-detect-build-id", (_, gameFolder?: string) => {
  return detectPuckBuildId(gameFolder);
});

ipcMain.handle("workshop-list-items", () => {
  return listWorkshopItems();
});

ipcMain.handle("workshop-get-item-for-pack", (_, packName: string) => {
  return getWorkshopItemForPack(packName);
});

ipcMain.handle("workshop-save-item", (_, record: WorkshopItemRecord) => {
  return upsertWorkshopItem(record);
});

ipcMain.handle("workshop-delete-item-tracking", (_, localId: string) => {
  return deleteWorkshopItem(localId);
});

ipcMain.handle("workshop-select-preview", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: "Select a Workshop preview image",
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("workshop-select-content-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: "Select the folder to upload",
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("workshop-validate-preview", (_, sourcePath: string) => {
  return validatePreviewImage(sourcePath);
});

// Store the chosen preview into app data (never inside the content folder),
// recompressing it under Steam's 1MB limit when requested.
ipcMain.handle(
  "workshop-prepare-preview",
  (_, keySeed: string, sourcePath: string, recompress: boolean) => {
    try {
      const key = safePreviewKey(keySeed);
      if (recompress) {
        const dest = previewDestFor(key, ".jpg");
        const r = recompressPreviewImage(sourcePath, dest);
        if (!r.success) {
          return { success: false, error: r.error };
        }
        return {
          success: true,
          path: r.path,
          sizeBytes: r.sizeBytes,
          recompressed: true,
        };
      }
      const stored = storePreview(key, sourcePath);
      const fs = require("fs");
      return {
        success: true,
        path: stored,
        sizeBytes: fs.statSync(stored).size,
        recompressed: false,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);

ipcMain.handle("workshop-get-live-metadata", (_, publishedFileId: string) => {
  return getLiveMetadata(publishedFileId);
});

ipcMain.handle("workshop-list-my-published", () => {
  return listMyPublishedItems();
});

ipcMain.handle("workshop-publish", (_, req: PublishRequest) => {
  return publishWorkshopItem(req);
});

// Refresh all tracked items' metadata from Steam in one batch.
ipcMain.handle("workshop-sync-all", () => {
  return syncAllFromSteam();
});

// Preview the files that will be uploaded from a content folder.
ipcMain.handle("workshop-list-content-files", (_, contentPath: string) => {
  if (!contentPath) return { files: [], totalBytes: 0, totalCount: 0, truncated: false };
  return listContentFiles(contentPath);
});

// Import tracking data from the legacy SteamWorkshopUploader. Opens a folder
// picker (defaulting to the given path) and imports every .workshop.json found.
ipcMain.handle("workshop-import-swu", async (_, defaultPath?: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title:
      "Select your SteamWorkshopUploader folder (or its WorkshopContent folder)",
    defaultPath: defaultPath || undefined,
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  try {
    return importFromSteamWorkshopUploader(result.filePaths[0]);
  } catch (error) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      entries: [],
      error: String(error),
    };
  }
});
