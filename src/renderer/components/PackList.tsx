import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, RotateCw } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import "./PackList.css";

interface PackInfo {
  folderName: string;
  displayName: string;
  reskinCount: number;
}

interface PackListProps {
  gameFolder: string;
  onSelectPack: (packName: string, isWorkshop?: boolean) => void;
  onOpenAbout: () => void;
  onOpenWorkshop: () => void;
}

export default function PackList({ gameFolder, onSelectPack, onOpenAbout, onOpenWorkshop }: PackListProps) {
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [workshopReskinPacks, setWorkshopReskinPacks] = useState<any[]>([]);
  const [workshopMods, setWorkshopMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPackName, setNewPackName] = useState("");
  const [creatingPack, setCreatingPack] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ folderName: string; displayName: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllContent();
  }, [gameFolder]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    const started = performance.now();
    await loadAllContent();
    const elapsed = performance.now() - started;
    if (elapsed < 500) {
      await new Promise((r) => setTimeout(r, 500 - elapsed));
    }
    setRefreshing(false);
  }

  async function loadAllContent() {
    try {
      setLoading(true);
      setError(null);
      await loadPacks();
      await loadWorkshopMods();
    } catch (err) {
      setError("Failed to load content");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPacks() {
    try {
      const packList = await (window as any).electron.listReskinPacks(gameFolder);

      // Load pack data to get reskin counts and display names
      const packsWithCounts: PackInfo[] = await Promise.all(
        packList.map(async (packName: string) => {
          try {
            const packData = await (window as any).electron.readReskinPack(gameFolder, packName);
            return {
              folderName: packName,
              displayName: packData.name || packName,
              reskinCount: packData.reskins?.length || 0,
            };
          } catch {
            return {
              folderName: packName,
              displayName: packName,
              reskinCount: 0,
            };
          }
        })
      );

      setPacks(packsWithCounts);
    } catch (err) {
      setError("Failed to load reskin packs");
      console.error(err);
    }
  }

  async function loadWorkshopMods() {
    try {
      const allMods = await (window as any).electron.scanWorkshopMods(gameFolder);
      console.log("Workshop mods found:", allMods);

      // Separate into reskin packs and other mods
      const reskinPacks = allMods.filter((mod: any) => mod.isReskinPack);
      const otherMods = allMods.filter((mod: any) => !mod.isReskinPack);

      console.log("Workshop reskin packs:", reskinPacks);
      console.log("Other mods:", otherMods);

      setWorkshopReskinPacks(reskinPacks);
      setWorkshopMods(otherMods);
    } catch (err) {
      console.error("Failed to scan workshop mods:", err);
      // Don't show error if workshop scanning fails - it's optional
    }
  }

  async function handleCreatePack(e: React.FormEvent) {
    e.preventDefault();

    if (!newPackName.trim()) {
      setError("Pack name cannot be empty");
      return;
    }

    try {
      setCreatingPack(true);
      setError(null);
      await (window as any).electron.createReskinPack(gameFolder, newPackName);
      setNewPackName("");
      loadPacks();
    } catch (err) {
      setError("Failed to create pack");
      console.error(err);
    } finally {
      setCreatingPack(false);
    }
  }

  async function handleConfirmDelete(folderName: string) {
    try {
      setError(null);
      await (window as any).electron.deleteReskinPack(gameFolder, folderName);
      setDeleteConfirm(null);
      loadPacks();
    } catch (err) {
      setError("Failed to delete pack");
      console.error(err);
    }
  }

  return (
    <div className="pack-list">
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Pack?"
          message={
            <>
              Are you sure you want to delete <strong>{deleteConfirm.displayName}</strong>? This cannot be undone and all files in this pack will be deleted.
            </>
          }
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          onConfirm={() => handleConfirmDelete(deleteConfirm.folderName)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <div className="list-header">
        <div>
          <h2>Your Reskin Packs</h2>
          <p className="pack-count">
            {packs.length} pack{packs.length !== 1 ? "s" : ""} ({packs.reduce((sum, pack) => sum + pack.reskinCount, 0)} total reskins)
          </p>
        </div>
        <div className="header-buttons">
          <button
            onClick={handleRefresh}
            className="refresh-button"
            title="Refresh pack list"
            disabled={refreshing || loading}
          >
            <RotateCw size={18} className={refreshing ? "spinning" : ""} />
          </button>
        </div>
      </div>

      <form onSubmit={handleCreatePack} className="create-pack-form">
        <div className="form-group">
          <label htmlFor="pack-name">Create New Pack</label>
          <div className="input-group">
            <input
              id="pack-name"
              type="text"
              placeholder="Enter pack name (e.g., 'My Custom Reskins')"
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              disabled={creatingPack}
            />
            <button
              type="submit"
              disabled={creatingPack || !newPackName.trim()}
              className="primary-button"
            >
              <Plus size={16} />
              {creatingPack ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="close-button"
          >
            ✕
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading packs...</p>
        </div>
      )}

      {!loading && packs.length === 0 && (
        <div className="empty-state">
          <p>No reskin packs yet. Create one above to get started!</p>
        </div>
      )}

      {!loading && packs.length > 0 && (
        <div>
          <h3 className="section-title">Local Reskin Packs</h3>
          <div className="packs-grid">
            {packs.map((pack) => (
              <div key={pack.folderName} className="pack-card">
                <div className="pack-header">
                  <div>
                    <h3 className="pack-name">{pack.displayName}</h3>
                    <p className="reskin-count">{pack.reskinCount} reskin{pack.reskinCount !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm({ folderName: pack.folderName, displayName: pack.displayName })}
                    className="delete-button"
                    title="Delete pack"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <button
                  onClick={() => onSelectPack(pack.folderName)}
                  className="open-button"
                >
                  <Edit2 size={16} />
                  Edit Pack
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && workshopReskinPacks.length > 0 && (
        <div>
          <h3 className="section-title workshop">Workshop Reskin Packs</h3>
          <div className="packs-grid">
            {workshopReskinPacks.map((mod) => (
              <div key={mod.workshopId} className="pack-card workshop-pack">
                {mod.thumbnailUrl && (
                  <img src={mod.thumbnailUrl} alt={mod.displayName} className="pack-thumbnail" />
                )}
                <div className="pack-header">
                  <div>
                    <h3 className="pack-name">{mod.displayName}</h3>
                    <p className="workshop-id">ID: {mod.workshopId}</p>
                  </div>
                </div>
                <div className="button-group">
                  <button
                    onClick={() => onSelectPack(mod.workshopId, true)}
                    className="open-button workshop"
                  >
                    <Edit2 size={16} />
                    Browse Pack
                  </button>
                  <button
                    onClick={() => (window as any).electron.openExternalUrl(`https://steamcommunity.com/workshop/filedetails/?id=${mod.workshopId}`)}
                    className="open-button workshop secondary"
                  >
                    View on Steam
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && workshopMods.length > 0 && (
        <div>
          <h3 className="section-title">Other Workshop Mods</h3>
          <div className="packs-grid">
            {workshopMods.map((mod) => (
              <div key={mod.workshopId} className="pack-card workshop-pack other-mod">
                {mod.thumbnailUrl && (
                  <img src={mod.thumbnailUrl} alt={mod.displayName} className="pack-thumbnail" />
                )}
                <div className="pack-header">
                  <div>
                    <h3 className="pack-name">{mod.displayName}</h3>
                    <p className="workshop-id">ID: {mod.workshopId}</p>
                  </div>
                </div>
                <button
                  onClick={() => (window as any).electron.openExternalUrl(`https://steamcommunity.com/workshop/filedetails/?id=${mod.workshopId}`)}
                  className="open-button workshop"
                >
                  View on Steam
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
