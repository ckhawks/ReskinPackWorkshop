import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { DEFAULT_GAME_PATH, PUCK_GAME_NAME, RESKINPACKS_FOLDER } from "./constants";

/**
 * Attempt to detect the Puck game folder by:
 * 1. Checking default Steam path
 * 2. Checking registry for Steam install location
 * 3. Falling back to user selection
 */
export async function detectGameFolder(): Promise<string | null> {
  // First try default path
  if (fs.existsSync(DEFAULT_GAME_PATH)) {
    const reskinpacksPath = path.join(DEFAULT_GAME_PATH, RESKINPACKS_FOLDER);
    if (fs.existsSync(reskinpacksPath)) {
      return DEFAULT_GAME_PATH;
    }
  }

  // Try to detect from Windows registry (Steam location)
  const steamPath = detectSteamPath();
  if (steamPath) {
    const puckPath = path.join(
      steamPath,
      "steamapps",
      "common",
      PUCK_GAME_NAME
    );
    if (fs.existsSync(puckPath)) {
      const reskinpacksPath = path.join(puckPath, RESKINPACKS_FOLDER);
      if (fs.existsSync(reskinpacksPath)) {
        return puckPath;
      }
    }
  }

  return null;
}

/**
 * Detect Steam installation path from Windows registry, with fallback to common paths
 */
function detectSteamPath(): string | null {
  // First, try to read from Windows registry
  try {
    const output = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam" /v InstallPath',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );

    // Parse the output to extract the path
    const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
    if (match && match[1]) {
      const steamPath = match[1].trim();
      if (fs.existsSync(steamPath)) {
        console.log("Steam path found in registry:", steamPath);
        return steamPath;
      }
    }
  } catch (error) {
    console.log("Could not read Steam path from registry, falling back to common paths");
  }

  // Fallback to common Steam paths
  const commonSteamPaths = [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    "D:\\Steam",
    "E:\\Steam",
  ];

  for (const steamPath of commonSteamPaths) {
    if (fs.existsSync(steamPath)) {
      console.log("Steam path found at common location:", steamPath);
      return steamPath;
    }
  }

  return null;
}

/**
 * Check if a folder is a valid Puck game folder
 */
export function isValidGameFolder(folderPath: string): boolean {
  try {
    const reskinpacksPath = path.join(folderPath, RESKINPACKS_FOLDER);
    return fs.existsSync(reskinpacksPath);
  } catch {
    return false;
  }
}

/**
 * Get the reskinpacks folder path
 */
export function getReskinpacksFolder(gameFolder: string): string {
  return path.join(gameFolder, RESKINPACKS_FOLDER);
}
