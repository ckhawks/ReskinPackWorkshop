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
  validateImage: (imagePath: string) =>
    ipcRenderer.invoke("validate-image", imagePath),
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
});
