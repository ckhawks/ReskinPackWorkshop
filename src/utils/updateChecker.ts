import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import semver from "semver";

export interface VersionInfo {
  latest: string;
  downloadUrl: string;
  notes?: string;
}

// The app's GitHub repo. Update checks read its published Releases directly, so
// there's no separate version file to maintain.
const GITHUB_REPO = "ckhawks/ReskinPackWorkshop";
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Resolve the current app version. app.getVersion() returns Electron's version
 * when run from source in dev, so read package.json to be safe (matches the
 * packaged version too).
 */
function currentVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")
    );
    if (pkg.version) return pkg.version;
  } catch {
    /* fall through */
  }
  return app.getVersion();
}

/**
 * Check GitHub Releases for a newer version. Returns null if up to date, on any
 * error, or if the latest release isn't a valid higher semver.
 */
export async function checkForUpdates(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        // GitHub's API requires a User-Agent header.
        "User-Agent": "ReskinPackWorkshop-UpdateChecker",
      },
    });

    if (!response.ok) {
      // 404 simply means no published (non-draft, non-prerelease) release yet.
      console.warn("Update check failed:", response.status, response.statusText);
      return null;
    }

    const release: any = await response.json();
    const tag: string = release.tag_name || "";
    // Tags are usually like "v1.2.0"; coerce to a clean semver.
    const latest = semver.valid(semver.coerce(tag) || "");
    if (!latest) return null;

    const current = currentVersion();
    if (!semver.gt(latest, current)) return null;

    // Prefer a downloadable .exe asset; fall back to the release page.
    const exeAsset = (release.assets || []).find(
      (a: any) => typeof a.name === "string" && a.name.toLowerCase().endsWith(".exe")
    );
    const downloadUrl: string =
      exeAsset?.browser_download_url || release.html_url;

    return {
      latest,
      downloadUrl,
      notes: typeof release.body === "string" ? release.body.trim() : undefined,
    };
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
