import { app } from "electron";
import { compare } from "semver";

export interface VersionInfo {
  latest: string;
  downloadUrl: string;
  notes?: string;
}

const VERSION_CHECK_URL =
  "https://raw.githubusercontent.com/anthropics/reskin-pack-workshop/main/version.json";

/**
 * Check if a newer version is available
 */
export async function checkForUpdates(): Promise<VersionInfo | null> {
  try {
    const currentVersion = app.getVersion();
    const response = await fetch(VERSION_CHECK_URL);

    if (!response.ok) {
      console.warn("Failed to fetch version info:", response.statusText);
      return null;
    }

    const versionInfo: VersionInfo = await response.json();

    // Compare versions
    const comparison = compare(versionInfo.latest, currentVersion);

    // comparison > 0 means latest > current (update available)
    if (comparison > 0) {
      return versionInfo;
    }

    return null;
  } catch (error) {
    console.error("Error checking for updates:", error);
    return null;
  }
}

/**
 * Format update message
 */
export function formatUpdateMessage(versionInfo: VersionInfo): string {
  return `Version ${versionInfo.latest} is available. ${
    versionInfo.notes || "New features and improvements included."
  }`;
}
