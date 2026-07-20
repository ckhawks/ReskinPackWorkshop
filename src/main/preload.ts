import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config: any) => ipcRenderer.invoke("save-config", config),
  detectGameFolder: () => ipcRenderer.invoke("detect-game-folder"),
  validateGameFolder: (folderPath: string) =>
    ipcRenderer.invoke("validate-game-folder", folderPath),
  selectGameFolder: () => ipcRenderer.invoke("select-game-folder"),
  listReskinPacks: (gameFolder: string) =>
    ipcRenderer.invoke("list-reskin-packs", gameFolder),
  readReskinPack: (gameFolder: string, packName: string) =>
    ipcRenderer.invoke("read-reskin-pack", gameFolder, packName),
  createReskinPack: (gameFolder: string, packName: string) =>
    ipcRenderer.invoke("create-reskin-pack", gameFolder, packName),
  saveReskinPack: (gameFolder: string, packName: string, pack: any) =>
    ipcRenderer.invoke("save-reskin-pack", gameFolder, packName, pack),
  deleteReskinPack: (gameFolder: string, packName: string) =>
    ipcRenderer.invoke("delete-reskin-pack", gameFolder, packName),
  selectImage: () => ipcRenderer.invoke("select-image"),
  validateImage: (imagePath: string, reskinType?: string) =>
    ipcRenderer.invoke("validate-image", imagePath, reskinType),
  copyImageToPack: (
    gameFolder: string,
    packName: string,
    sourceImagePath: string,
    reskinType: string,
    imageName: string
  ) =>
    ipcRenderer.invoke(
      "copy-image-to-pack",
      gameFolder,
      packName,
      sourceImagePath,
      reskinType,
      imageName
    ),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url),
  openFolder: (folderPath: string) => ipcRenderer.invoke("open-folder", folderPath),
  openFile: (filePath: string) => ipcRenderer.invoke("open-file", filePath),
  openWithApp: (filePath: string) => ipcRenderer.invoke("open-with-app", filePath),
  openWithDialog: (filePath: string) => ipcRenderer.invoke("open-with-dialog", filePath),
  readImageAsDataUrl: (imagePath: string) => ipcRenderer.invoke("read-image-as-data-url", imagePath),
  saveDroppedFile: (fileName: string, base64Data: string) => ipcRenderer.invoke("save-dropped-file", fileName, base64Data),
  scanWorkshopMods: (gameFolder: string) => ipcRenderer.invoke("scan-workshop-mods", gameFolder),
  getWorkshopModPath: (workshopId: string, gameFolder: string) => ipcRenderer.invoke("get-workshop-mod-path", workshopId, gameFolder),
  readWorkshopReskinPack: (workshopId: string, gameFolder: string) => ipcRenderer.invoke("read-workshop-reskin-pack", workshopId, gameFolder),
  replaceImage: (destPath: string, sourceImagePath: string) => ipcRenderer.invoke("replace-image", destPath, sourceImagePath),

  // Steam Workshop publishing
  workshopGetSteamStatus: () => ipcRenderer.invoke("workshop-get-steam-status"),
  workshopDetectBuildId: (gameFolder?: string) => ipcRenderer.invoke("workshop-detect-build-id", gameFolder),
  workshopListItems: () => ipcRenderer.invoke("workshop-list-items"),
  workshopGetItemForPack: (packName: string) => ipcRenderer.invoke("workshop-get-item-for-pack", packName),
  workshopSaveItem: (record: any) => ipcRenderer.invoke("workshop-save-item", record),
  workshopDeleteItemTracking: (localId: string) => ipcRenderer.invoke("workshop-delete-item-tracking", localId),
  workshopSelectPreview: () => ipcRenderer.invoke("workshop-select-preview"),
  workshopSelectContentFolder: () => ipcRenderer.invoke("workshop-select-content-folder"),
  workshopValidatePreview: (sourcePath: string) => ipcRenderer.invoke("workshop-validate-preview", sourcePath),
  workshopPreparePreview: (keySeed: string, sourcePath: string, recompress: boolean) =>
    ipcRenderer.invoke("workshop-prepare-preview", keySeed, sourcePath, recompress),
  workshopGetLiveMetadata: (publishedFileId: string) => ipcRenderer.invoke("workshop-get-live-metadata", publishedFileId),
  workshopListMyPublished: () => ipcRenderer.invoke("workshop-list-my-published"),
  workshopPublish: (req: any) => ipcRenderer.invoke("workshop-publish", req),
  workshopImportSwu: (defaultPath?: string) => ipcRenderer.invoke("workshop-import-swu", defaultPath),
  workshopListContentFiles: (contentPath: string) => ipcRenderer.invoke("workshop-list-content-files", contentPath),
  workshopSyncAll: () => ipcRenderer.invoke("workshop-sync-all"),
});
