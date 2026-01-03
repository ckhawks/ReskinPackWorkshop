import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { AppConfig } from "../types";

const CONFIG_DIR = path.join(os.homedir(), "AppData", "Local", "ReskinBuilder");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load app configuration
 */
export function loadConfig(): AppConfig {
  try {
    ensureConfigDir();

    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }

  return {};
}

/**
 * Save app configuration
 */
export function saveConfig(config: AppConfig): boolean {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving config:", error);
    return false;
  }
}

/**
 * Get config directory (useful for storing other app data)
 */
export function getConfigDir(): string {
  ensureConfigDir();
  return CONFIG_DIR;
}
