import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus, ExternalLink, BookOpen, Folder, FileText, Image, RotateCw } from "lucide-react";
import { ReskinPack, ReskinType } from "../../types";
import { RESKIN_TYPE_LABELS, getReskinTypeLabel } from "../../utils/constants";
import ReskinForm from "./ReskinForm";
import ReskinPreview from "./ReskinPreview";
import "./PackEditor.css";

interface PackEditorProps {
  gameFolder: string;
  packName: string;
  isWorkshopPack?: boolean;
  onBack: () => void;
}

export default function PackEditor({
  gameFolder,
  packName,
  isWorkshopPack = false,
  onBack,
}: PackEditorProps) {
  const [pack, setPack] = useState<ReskinPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savedPack, setSavedPack] = useState<ReskinPack | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [packPath, setPackPath] = useState<string>("");

  useEffect(() => {
    loadPack();
  }, [gameFolder, packName]);

  // Auto-save reskins when they change
  useEffect(() => {
    if (!pack || !savedPack) return;
    // Only auto-save if reskins have changed, not metadata
    if (JSON.stringify(pack.reskins) !== JSON.stringify(savedPack.reskins)) {
      const timer = setTimeout(() => {
        autoSavePack();
      }, 500); // Debounce auto-save by 500ms
      return () => clearTimeout(timer);
    }
  }, [pack?.reskins]);

  async function loadPack() {
    try {
      setLoading(true);
      setError(null);
      console.log("Loading pack:", { gameFolder, packName, isWorkshopPack });

      let data;
      let actualPackPath: string;

      if (isWorkshopPack) {
        // Get workshop mod path
        const workshopPath = await (window as any).electron.getWorkshopModPath(
          packName,
          gameFolder
        );
        if (!workshopPath) {
          setError("Could not find workshop mod path");
          setPack(null);
          return;
        }
        actualPackPath = workshopPath;

        data = await (window as any).electron.readWorkshopReskinPack(
          packName,
          gameFolder
        );
      } else {
        actualPackPath = `${gameFolder}/reskinpacks/${packName}`;
        data = await (window as any).electron.readReskinPack(
          gameFolder,
          packName
        );
      }

      console.log("Pack data loaded:", data);

      if (!data) {
        setError("Pack data is empty or missing");
        setPack(null);
        return;
      }

      setPackPath(actualPackPath);
      setPack(data);
      setSavedPack(JSON.parse(JSON.stringify(data))); // Deep copy
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to load pack data: ${errorMessage}`);
      console.error("Error loading pack:", err);
      setPack(null);
    } finally {
      setLoading(false);
    }
  }

  async function autoSavePack() {
    if (!pack || isWorkshopPack) return; // Don't auto-save workshop packs

    try {
      setAutoSaving(true);
      await (window as any).electron.saveReskinPack(gameFolder, packName, pack);
      setSavedPack(JSON.parse(JSON.stringify(pack))); // Deep copy
    } catch (err) {
      console.error("Auto-save failed:", err);
    } finally {
      setAutoSaving(false);
    }
  }

  async function savePack() {
    if (!pack) return;

    try {
      setSaving(true);
      setError(null);
      await (window as any).electron.saveReskinPack(gameFolder, packName, pack);
      setSavedPack(JSON.parse(JSON.stringify(pack))); // Deep copy
    } catch (err) {
      setError("Failed to save pack");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function hasUnsavedMetadata() {
    if (!pack || !savedPack) return false;
    return pack.name !== savedPack.name || pack.version !== savedPack.version;
  }

  function handleRemoveReskin(index: number) {
    if (!pack) return;
    const newReskins = pack.reskins.filter((_, i) => i !== index);
    setPack({ ...pack, reskins: newReskins });
  }

  function handleUpdatePackName(newName: string) {
    if (!pack) return;
    setPack({ ...pack, name: newName });
  }

  function handleUpdatePackVersion(newVersion: string) {
    if (!pack) return;
    setPack({ ...pack, version: newVersion });
  }

  function handleAddReskin(newReskin: any) {
    if (!pack) return;
    setPack({
      ...pack,
      reskins: [...pack.reskins, newReskin],
    });
    setShowAddForm(false);
  }

  function getReskinTypeSummary() {
    if (!pack || !Array.isArray(pack.reskins)) return [];
    try {
      const summary: Array<{ type: string; count: number }> = [];
      const typeCounts: Record<string, number> = {};

      pack.reskins.forEach((reskin) => {
        if (reskin && reskin.type) {
          typeCounts[reskin.type] = (typeCounts[reskin.type] || 0) + 1;
        }
      });

      Object.entries(typeCounts).forEach(([type, count]) => {
        summary.push({ type, count });
      });

      return summary.sort((a, b) => getReskinTypeLabel(a.type).localeCompare(getReskinTypeLabel(b.type)));
    } catch (err) {
      console.error("Error in getReskinTypeSummary:", err);
      return [];
    }
  }

  function getReskinsByType() {
    if (!pack || !Array.isArray(pack.reskins)) return new Map<string, any[]>();
    try {
      const grouped = new Map<string, any[]>();

      // Get all unique types in the pack, sorted by label
      const types = [...new Set(pack.reskins.map((r) => r?.type).filter(Boolean))].sort(
        (a, b) => getReskinTypeLabel(a).localeCompare(getReskinTypeLabel(b))
      );

      // Group reskins by type
      types.forEach((type) => {
        const reskins = pack.reskins.filter((r) => r?.type === type);
        grouped.set(type, reskins);
      });

      return grouped;
    } catch (err) {
      console.error("Error in getReskinsByType:", err);
      return new Map<string, any[]>();
    }
  }

  return (
    <div className="pack-editor">
      {!loading && (
        <div className="editor-header">
          <button onClick={onBack} className="back-button">
            <ArrowLeft size={20} />
            Back
          </button>
          <h2>Editing: {pack ? savedPack?.name || packName : packName}</h2>
          <div className="header-buttons">
            <button
              onClick={() => {
                loadPack();
                setRefreshTrigger(prev => prev + 1);
              }}
              className="folder-button"
              title="Refresh pack data"
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={() => (window as any).electron.openWithApp(`${packPath}/reskinpack.json`)}
              className="folder-button"
              title="Open reskinpack.json with default editor"
            >
              <FileText size={18} />
            </button>
            <button
              onClick={() => (window as any).electron.openFolder(packPath)}
              className="folder-button"
              title="Open pack folder in Explorer"
            >
              <Folder size={18} />
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading pack...</p>
        </div>
      )}

      {!loading && !pack && (
        <div className="error-state">
          <p>Failed to load pack data</p>
          <button onClick={onBack} className="back-button">
            Back to Packs
          </button>
        </div>
      )}

      {pack && (
        <>
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

      <div className="pack-metadata">
        <div className="form-group">
          <label htmlFor="pack-name">Pack Name</label>
          <input
            id="pack-name"
            type="text"
            value={pack.name}
            onChange={(e) => handleUpdatePackName(e.target.value)}
            disabled={isWorkshopPack}
          />
        </div>

        <div className="form-group">
          <label htmlFor="pack-version">Version</label>
          <input
            id="pack-version"
            type="text"
            value={pack.version}
            onChange={(e) => handleUpdatePackVersion(e.target.value)}
            placeholder="1.0.0"
            disabled={isWorkshopPack}
          />
        </div>

        {!isWorkshopPack && (
          <div className="form-group">
            <button
              onClick={savePack}
              disabled={!hasUnsavedMetadata() || saving}
              className="save-button"
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <div className="resources-section">
        <button
          onClick={() => (window as any).electron.openExternalUrl(
            "https://github.com/ckhawks/ToastersReskinLoader/wiki/How-to-Reskin-%E2%80%94-Texture-Templates-and-Guides"
          )}
          className="resources-link"
        >
          <BookOpen size={16} />
          View Texture Templates & UV Maps
          <ExternalLink size={14} />
        </button>
      </div>

      {pack.reskins.length > 0 && (
        <div className="reskin-summary-section">
          <h3>Reskin Summary</h3>
          <div className="summary-grid">
            {getReskinTypeSummary().map((item) => (
              <div key={item.type} className="summary-item">
                <span className="summary-label">{getReskinTypeLabel(item.type)}</span>
                <span className="summary-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="reskins-section">
        <div className="section-header">
          <h3>Reskins ({pack.reskins.length})</h3>
          {!isWorkshopPack && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="add-button"
            >
              <Plus size={16} />
              {showAddForm ? "Cancel" : "Add Reskin"}
            </button>
          )}
        </div>

        {!isWorkshopPack && showAddForm && (
          <ReskinForm
            gameFolder={gameFolder}
            packName={packName}
            onAdd={handleAddReskin}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {pack.reskins.length === 0 && !showAddForm && (
          <div className="empty-reskins">
            <p>No reskins in this pack yet. Add one to get started!</p>
          </div>
        )}

        {pack.reskins.length > 0 && (
          <div className="reskins-by-type">
            {Array.from(getReskinsByType().entries()).map(([type, reskins]) => (
              <div key={type} className="reskin-type-group">
                <h4 className="type-group-header">{getReskinTypeLabel(type)}</h4>
                <div className="reskins-grid">
                  {reskins.map((reskin, typeIndex) => {
                    const globalIndex = pack.reskins.findIndex(
                      (r) => r.type === reskin.type && r.name === reskin.name && r.path === reskin.path
                    );
                    return (
                      <ReskinPreview
                        key={`${type}-${typeIndex}`}
                        packPath={packPath}
                        reskin={reskin}
                        onDelete={!isWorkshopPack ? () => handleRemoveReskin(globalIndex) : undefined}
                        refreshTrigger={refreshTrigger}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
