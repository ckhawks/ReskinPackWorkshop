import React, { useState, useEffect } from "react";
import "./GameDetection.css";

interface GameDetectionProps {
  onGameFolderSelected: (folder: string) => void;
}

export default function GameDetection({ onGameFolderSelected }: GameDetectionProps) {
  const [detectedFolder, setDetectedFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectGame();
  }, []);

  async function detectGame() {
    try {
      setLoading(true);
      setError(null);
      const detected = await (window as any).electron.detectGameFolder();
      setDetectedFolder(detected);
    } catch (err) {
      setError("Failed to detect game folder");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectManually() {
    try {
      const selected = await (window as any).electron.selectGameFolder();
      if (selected) {
        onGameFolderSelected(selected);
      } else {
        setError("Invalid game folder selected");
      }
    } catch (err) {
      setError("Failed to select folder");
      console.error(err);
    }
  }

  async function handleUseDetected() {
    if (detectedFolder) {
      onGameFolderSelected(detectedFolder);
    }
  }

  return (
    <div className="game-detection">
      <div className="detection-container">
        <h2>Locate Your Puck Game</h2>
        <p className="subtitle">The app needs to find your Puck game folder to manage reskin packs.</p>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Searching for Puck game folder...</p>
          </div>
        )}

        {!loading && detectedFolder && (
          <div className="detection-result success">
            <div className="result-icon">✓</div>
            <div className="result-content">
              <h3>Puck folder detected!</h3>
              <p className="folder-path">{detectedFolder}</p>
              <button
                onClick={handleUseDetected}
                className="primary-button"
              >
                Use This Folder
              </button>
            </div>
          </div>
        )}

        {!loading && !detectedFolder && (
          <div className="detection-result not-found">
            <div className="result-icon">!</div>
            <div className="result-content">
              <h3>Puck folder not found automatically</h3>
              <p>Please select your Puck game folder manually.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <div className="action-buttons">
          <button
            onClick={handleSelectManually}
            className="secondary-button"
          >
            Select Folder Manually
          </button>
          <button
            onClick={detectGame}
            className="secondary-button"
            disabled={loading}
          >
            Search Again
          </button>
        </div>

        <div className="help-text">
          <p>
            <strong>Where is the Puck game folder?</strong>
            <br />
            Usually located at: <code>C:\Program Files (x86)\Steam\steamapps\common\Puck</code>
          </p>
        </div>
      </div>
    </div>
  );
}
