import React, { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  ExternalLink,
  Package,
  Puzzle,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-react";
import { WorkshopItemRecord } from "../../types";
import PublishModal from "./PublishModal";
import ConfirmDialog from "./ConfirmDialog";
import "./WorkshopPage.css";

interface WorkshopPageProps {
  gameFolder: string;
}

const el = () => (window as any).electron;

type ModalState =
  | { kind: "reskin-pack"; packName: string; existing?: WorkshopItemRecord | null; defaultTitle?: string }
  | { kind: "generic"; existing?: WorkshopItemRecord | null }
  | null;

export default function WorkshopPage({ gameFolder }: WorkshopPageProps) {
  const [items, setItems] = useState<WorkshopItemRecord[]>([]);
  const [steamStatus, setSteamStatus] = useState<any>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkshopItemRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [list, status] = await Promise.all([
        el().workshopListItems(),
        el().workshopGetSteamStatus(),
      ]);
      setItems(list || []);
      setSteamStatus(status);
      loadThumbs(list || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Load preview thumbnails (stored in app data) as data URLs for the rows.
  async function loadThumbs(list: WorkshopItemRecord[]) {
    const pairs = await Promise.all(
      list
        .filter((i) => i.previewPath)
        .map(async (i) => {
          try {
            const url = await el().readImageAsDataUrl(i.previewPath);
            return url ? ([i.localId, url] as const) : null;
          } catch {
            return null;
          }
        })
    );
    const map: Record<string, string> = {};
    for (const p of pairs) if (p) map[p[0]] = p[1];
    setThumbs(map);
  }

  function handlePublished() {
    setModal(null);
    refresh();
  }

  // Manual refresh with a guaranteed-visible spin (the work itself is instant).
  async function handleManualRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    const started = performance.now();
    await refresh();
    const elapsed = performance.now() - started;
    if (elapsed < 500) {
      await new Promise((r) => setTimeout(r, 500 - elapsed));
    }
    setRefreshing(false);
  }

  async function handleSyncAll() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await el().workshopSyncAll();
      if (res?.error) {
        setSyncStatus(res.error);
        setSyncOk(false);
      } else {
        setSyncStatus(
          `Synced ${res.synced} of ${res.checked} published item${
            res.checked !== 1 ? "s" : ""
          } from Steam.`
        );
        setSyncOk(true);
        await refresh();
      }
    } catch (e) {
      setSyncStatus(String(e));
      setSyncOk(false);
    } finally {
      setSyncing(false);
    }
  }

  async function handleImportSwu() {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await el().workshopImportSwu(
        "C:\\PuckModdingTools\\SteamWorkshopUploader"
      );
      if (res) {
        setImportResult(res);
        await refresh();
      }
    } catch (e) {
      setImportResult({ error: String(e) });
    } finally {
      setImporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await el().workshopDeleteItemTracking(deleteTarget.localId);
    setDeleteTarget(null);
    refresh();
  }

  const byUpdatedDesc = (a: WorkshopItemRecord, b: WorkshopItemRecord) =>
    (b.lastPublishedAt || 0) - (a.lastPublishedAt || 0);
  const reskinItems = items
    .filter((i) => i.kind === "reskin-pack")
    .sort(byUpdatedDesc);
  const genericItems = items
    .filter((i) => i.kind === "generic")
    .sort(byUpdatedDesc);

  function formatUpdated(ts?: number): string {
    if (!ts) return "Never published";
    try {
      return `Updated ${new Date(ts).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`;
    } catch {
      return "";
    }
  }

  function renderRow(item: WorkshopItemRecord) {
    const published = !!item.publishedFileId;
    return (
      <div key={item.localId} className="ws-row">
        <div className="ws-row-icon">
          {thumbs[item.localId] ? (
            <img src={thumbs[item.localId]} alt="" />
          ) : item.kind === "reskin-pack" ? (
            <Package size={18} />
          ) : (
            <Puzzle size={18} />
          )}
        </div>
        <div className="ws-row-main">
          <h4>{item.title || item.packName || "Untitled"}</h4>
          <span className="ws-row-sub">
            {item.kind === "reskin-pack" ? "Reskin pack" : "Folder upload"}
            {published ? ` · ID ${item.publishedFileId}` : " · Not published yet"}
          </span>
        </div>
        <span className="ws-row-updated">{formatUpdated(item.lastPublishedAt)}</span>
        <div className="ws-row-actions">
          <button
            className="ws-edit"
            onClick={() =>
              setModal(
                item.kind === "reskin-pack"
                  ? {
                      kind: "reskin-pack",
                      packName: item.packName!,
                      existing: item,
                    }
                  : { kind: "generic", existing: item }
              )
            }
          >
            <Pencil size={15} />
            {published ? "Edit" : "Set up & publish"}
          </button>
          {published && (
            <button
              className="ws-secondary"
              title="View on Steam"
              onClick={() =>
                el().openExternalUrl(
                  `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedFileId}`
                )
              }
            >
              <ExternalLink size={15} />
            </button>
          )}
          <button
            className="ws-icon-button"
            title="Stop tracking (does not delete from Steam)"
            onClick={() => setDeleteTarget(item)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workshop-page">
      {deleteTarget && (
        <ConfirmDialog
          title="Stop tracking this item?"
          message={
            <>
              This removes local tracking for <strong>{deleteTarget.title}</strong>.
              It does <strong>not</strong> delete the item from the Steam
              Workshop. You can re-link it later by publishing again.
            </>
          }
          confirmText="Stop tracking"
          cancelText="Cancel"
          isDangerous={true}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <PublishModal
          gameFolder={gameFolder}
          kind={modal.kind}
          packName={modal.kind === "reskin-pack" ? modal.packName : undefined}
          existing={modal.existing}
          defaultTitle={
            modal.kind === "reskin-pack" ? (modal as any).defaultTitle : undefined
          }
          onClose={() => {
            setModal(null);
            // Reflect any details synced from Steam (e.g. an updated name).
            refresh();
          }}
          onPublished={handlePublished}
        />
      )}

      <div className="workshop-header">
        <h2>Steam Workshop</h2>
        <button
          onClick={handleManualRefresh}
          className="ws-icon-button"
          title="Refresh"
          disabled={refreshing}
        >
          <RotateCw size={18} className={refreshing ? "spin" : ""} />
        </button>
      </div>

      <div className={`ws-steam-status ${steamStatus?.available ? "ok" : "bad"}`}>
        {steamStatus?.available ? (
          <span>
            <CheckCircle2 size={16} /> Connected to Steam
            {steamStatus.personaName ? (
              <>
                {" "}as <strong>{steamStatus.personaName}</strong>
              </>
            ) : (
              ""
            )}
          </span>
        ) : (
          <span>
            <AlertTriangle size={16} />{" "}
            {steamStatus?.error ||
              "Start Steam and log in to publish Workshop items."}
          </span>
        )}
      </div>

      <div className="ws-actions-bar">
        <button
          className="ws-primary large"
          onClick={() => setModal({ kind: "generic" })}
        >
          <Plus size={16} /> New folder upload (plugin / mod)
        </button>
        <button
          className="ws-secondary"
          onClick={handleSyncAll}
          disabled={syncing}
          title="Fetch the latest name, description, tags and visibility for every tracked item from Steam"
        >
          <RefreshCw size={15} className={syncing ? "spin" : ""} />
          {syncing ? "Syncing…" : "Sync all from Steam"}
        </button>
        <button
          className="ws-secondary"
          onClick={handleImportSwu}
          disabled={importing}
        >
          <Download size={15} />
          {importing ? "Importing…" : "Import from SteamWorkshopUploader"}
        </button>
      </div>
      {syncStatus && (
        <p className={`ws-sync-status ${syncOk ? "ok" : "err"}`}>{syncStatus}</p>
      )}
      <p className="ws-hint ws-hint-block">
        Reskin packs also get a <strong>Publish</strong> button in the pack
        editor.
      </p>

      {importResult && (
        <div className="ws-import-result">
          <button
            className="ws-import-close"
            onClick={() => setImportResult(null)}
          >
            ✕
          </button>
          {importResult.error ? (
            <p className="err">Import failed: {importResult.error}</p>
          ) : (
            <>
              <strong>
                Imported {importResult.imported}, updated{" "}
                {importResult.updated}, skipped {importResult.skipped}.
              </strong>
              {importResult.skipped > 0 && (
                <ul>
                  {importResult.entries
                    .filter((e: any) => e.status === "skipped")
                    .map((e: any, i: number) => (
                      <li key={i}>
                        {e.title} — {e.reason}
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {reskinItems.length > 0 && (
        <section>
          <h3 className="ws-section-title">Reskin packs</h3>
          <div className="ws-list">{reskinItems.map(renderRow)}</div>
        </section>
      )}

      <section>
        <h3 className="ws-section-title">Folder uploads (plugins &amp; mods)</h3>
        {genericItems.length === 0 ? (
          <p className="ws-empty">
            No folder uploads yet. Use “New folder upload” to publish a plugin or
            any other mod folder.
          </p>
        ) : (
          <div className="ws-list">{genericItems.map(renderRow)}</div>
        )}
      </section>
    </div>
  );
}
