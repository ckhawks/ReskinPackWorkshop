import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PUCK_WORKSHOP_ID = "2994020";

export interface WorkshopMod {
  workshopId: string;
  isReskinPack: boolean;
  type: "local" | "workshop-reskin" | "workshop-mod";
  name?: string;
  displayName: string; // fallback to workshop ID if name not found
  thumbnailUrl?: string;
}

/**
 * Get Steam path from Windows registry
 */
function getSteamPathFromRegistry(): string | null {
  try {
    const output = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam" /v InstallPath',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );

    const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
    if (match && match[1]) {
      const steamPath = match[1].trim();
      if (fs.existsSync(steamPath)) {
        return steamPath;
      }
    }
  } catch (error) {
    console.log("Could not read Steam path from registry");
  }

  return null;
}

/**
 * Get Steam path - tries registry first, then derives from game folder
 */
export function getSteamPath(gameFolderPath?: string): string | null {
  // Try registry first
  const registrySteamPath = getSteamPathFromRegistry();
  if (registrySteamPath) {
    return registrySteamPath;
  }

  // Try to derive from game folder path
  // Game folder is typically: C:\Program Files (x86)\Steam\steamapps\common\Puck
  if (gameFolderPath) {
    const pathParts = gameFolderPath.split(path.sep);
    const steamappsIndex = pathParts.indexOf("steamapps");
    if (steamappsIndex !== -1) {
      // Reconstruct path to Steam folder
      const steamPath = pathParts.slice(0, steamappsIndex).join(path.sep);
      if (fs.existsSync(steamPath)) {
        return steamPath;
      }
    }
  }

  // Fallback to common paths
  const commonPaths = [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
  ];

  for (const steamPath of commonPaths) {
    if (fs.existsSync(steamPath)) {
      return steamPath;
    }
  }

  return null;
}

/**
 * Scan the Steam workshop folder for Puck mods
 */
export function scanWorkshopMods(gameFolderPath?: string): WorkshopMod[] {
  const mods: WorkshopMod[] = [];

  try {
    const steamPath = getSteamPath(gameFolderPath);
    if (!steamPath) {
      console.log("Could not determine Steam path");
      return mods;
    }

    const puckWorkshopPath = path.join(steamPath, "steamapps", "workshop", "content", PUCK_WORKSHOP_ID);

    if (!fs.existsSync(puckWorkshopPath)) {
      console.log("Workshop path not found:", puckWorkshopPath);
      return mods;
    }

    const modFolders = fs.readdirSync(puckWorkshopPath);

    for (const folder of modFolders) {
      const modPath = path.join(puckWorkshopPath, folder);
      const stat = fs.statSync(modPath);

      if (!stat.isDirectory()) continue;

      // Check if it's a reskin pack (has reskinpack.json)
      const reskinPackJsonPath = path.join(modPath, "reskinpack.json");
      const isReskinPack = fs.existsSync(reskinPackJsonPath);

      let modName: string | undefined;

      // For reskin packs, read the name from reskinpack.json
      if (isReskinPack) {
        try {
          const content = fs.readFileSync(reskinPackJsonPath, "utf-8");
          const packData = JSON.parse(content);
          if (packData.name) {
            modName = packData.name;
          }
        } catch (err) {
          console.log("Could not read reskinpack.json for mod:", folder);
        }
      } else {
        // For other mods, try to get name from metadata.vdf
        try {
          const metadataPath = path.join(modPath, "metadata.vdf");
          if (fs.existsSync(metadataPath)) {
            const content = fs.readFileSync(metadataPath, "utf-8");
            // Simple parsing - look for "title" field
            const titleMatch = content.match(/"title"\s*"([^"]+)"/);
            if (titleMatch) {
              modName = titleMatch[1];
            }
          }
        } catch (err) {
          console.log("Could not read metadata for mod:", folder);
        }
      }

      mods.push({
        workshopId: folder,
        isReskinPack,
        type: isReskinPack ? "workshop-reskin" : "workshop-mod",
        name: modName,
        displayName: modName || `Mod ${folder}`,
      });
    }
  } catch (error) {
    console.error("Error scanning workshop mods:", error);
  }

  return mods;
}

/**
 * Check if a workshop mod path exists
 */
export function getWorkshopModPath(workshopId: string, gameFolderPath?: string): string | null {
  const steamPath = getSteamPath(gameFolderPath);
  if (!steamPath) {
    return null;
  }

  const modPath = path.join(steamPath, "steamapps", "workshop", "content", PUCK_WORKSHOP_ID, workshopId);
  if (fs.existsSync(modPath)) {
    return modPath;
  }
  return null;
}
