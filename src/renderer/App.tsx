import React, { useState, useEffect } from "react";
import { Package, UploadCloud, HelpCircle } from "lucide-react";
import { AppConfig, ReskinPack } from "../types";
import GameDetection from "./components/GameDetection";
import PackList from "./components/PackList";
import PackEditor from "./components/PackEditor";
import About from "./components/About";
import WorkshopPage from "./components/WorkshopPage";
import UpdateNotification from "./components/UpdateNotification";
import "./App.css";

type Page = "game-detection" | "pack-list" | "pack-editor" | "about" | "workshop";

interface UpdateInfo {
  latest: string;
  downloadUrl: string;
  notes?: string;
}

export default function App() {
  const [gameFolder, setGameFolder] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("game-detection");
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [isWorkshopPack, setIsWorkshopPack] = useState(false);
  const [currentPackData, setCurrentPackData] = useState<ReskinPack | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    loadConfig();
    checkForUpdates();
    loadAppVersion();
  }, []);

  async function loadAppVersion() {
    try {
      const version = await (window as any).electron.getAppVersion();
      setAppVersion(version);
    } catch (error) {
      console.error("Error loading app version:", error);
    }
  }

  async function checkForUpdates() {
    try {
      const update = await (window as any).electron.checkForUpdates();
      if (update) {
        setUpdateInfo(update);
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    }
  }

  async function loadConfig() {
    try {
      const config = await (window as any).electron.getConfig();
      if (config.gameFolder) {
        setGameFolder(config.gameFolder);
        setCurrentPage("pack-list");
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
  }

  async function handleGameFolderSelected(folder: string) {
    setGameFolder(folder);

    // Save to config
    try {
      const config: AppConfig = { gameFolder: folder };
      await (window as any).electron.saveConfig(config);
    } catch (error) {
      console.error("Error saving config:", error);
    }

    setCurrentPage("pack-list");
  }

  function handleSelectPack(packName: string, isWorkshop: boolean = false) {
    setSelectedPack(packName);
    setIsWorkshopPack(isWorkshop);
    setCurrentPage("pack-editor");
  }

  function handleBackToPacks() {
    setCurrentPage("pack-list");
    setSelectedPack(null);
    setIsWorkshopPack(false);
    setCurrentPackData(null);
  }

  function handleChangeGame() {
    setGameFolder(null);
    setCurrentPage("game-detection");
    setSelectedPack(null);
    setCurrentPackData(null);
  }

  function handleOpenAbout() {
    setCurrentPage("about");
  }

  function handleOpenWorkshop() {
    setCurrentPage("workshop");
  }

  function handleGoPacks() {
    setSelectedPack(null);
    setIsWorkshopPack(false);
    setCurrentPackData(null);
    setCurrentPage("pack-list");
  }

  const packsActive =
    currentPage === "pack-list" || currentPage === "pack-editor";

  return (
    <div className="app">
      {updateInfo && (
        <UpdateNotification
          version={updateInfo.latest}
          notes={updateInfo.notes}
          downloadUrl={updateInfo.downloadUrl}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}

      <header className="app-header">
        <h1>Reskin Pack Workshop {appVersion && <span className="version">v{appVersion}</span>}</h1>
        {gameFolder && (
          <div className="game-folder-display">
            <span>Game: {gameFolder}</span>
            <button onClick={handleChangeGame} className="change-button">
              Change
            </button>
          </div>
        )}
      </header>

      {gameFolder && currentPage !== "game-detection" && (
        <nav className="app-nav">
          <button
            className={`nav-tab ${packsActive ? "active" : ""}`}
            onClick={handleGoPacks}
          >
            <Package size={17} />
            Reskin Packs
          </button>
          <button
            className={`nav-tab ${currentPage === "workshop" ? "active" : ""}`}
            onClick={handleOpenWorkshop}
          >
            <UploadCloud size={17} />
            Workshop
          </button>
          <div className="nav-spacer" />
          <button
            className={`nav-tab ${currentPage === "about" ? "active" : ""}`}
            onClick={handleOpenAbout}
          >
            <HelpCircle size={17} />
            About
          </button>
        </nav>
      )}

      <main className="app-main">
        {currentPage === "game-detection" && (
          <GameDetection onGameFolderSelected={handleGameFolderSelected} />
        )}

        {currentPage === "pack-list" && gameFolder && (
          <PackList
            gameFolder={gameFolder}
            onSelectPack={handleSelectPack}
            onOpenAbout={handleOpenAbout}
            onOpenWorkshop={handleOpenWorkshop}
          />
        )}

        {currentPage === "workshop" && gameFolder && (
          <WorkshopPage gameFolder={gameFolder} />
        )}

        {currentPage === "pack-editor" && gameFolder && selectedPack && (
          <PackEditor
            gameFolder={gameFolder}
            packName={selectedPack}
            isWorkshopPack={isWorkshopPack}
            onBack={handleBackToPacks}
          />
        )}

        {currentPage === "about" && <About />}
      </main>
    </div>
  );
}
