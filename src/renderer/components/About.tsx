import React from "react";
import { ArrowLeft, Github, Heart, MessageCircle, Package } from "lucide-react";
import "./About.css";

interface AboutProps {
  onBack: () => void;
}

export default function About({ onBack }: AboutProps) {
  const openUrl = (url: string) => {
    (window as any).electron.openExternalUrl(url);
  };

  return (
    <div className="about-container">
      <div className="about-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          Back
        </button>
        <h1>About Reskin Pack Workshop</h1>
      </div>

      <div className="about-content">
        <section className="about-section">
          <h2>Made by Stellaric</h2>
          <p>
            Reskin Pack Workshop is a tool created to simplify managing Puck game reskin packs.
          </p>
          <button
            onClick={() => openUrl("https://stellaric.pw")}
            className="about-link-button"
          >
            Visit Stellaric.pw
          </button>
        </section>

        <section className="about-section">
          <div className="about-section-header">
            <Package size={20} />
            <h2>Toaster's Reskin Loader</h2>
          </div>
          <p>
            This tool works with Toaster's Reskin Loader, a Steam Workshop mod for the Puck game.
          </p>
          <button
            onClick={() => openUrl("https://steamcommunity.com/workshop/filedetails/?id=3497550964")}
            className="about-link-button"
          >
            View on Steam Workshop
          </button>
        </section>

        <section className="about-section">
          <div className="about-section-header">
            <MessageCircle size={20} />
            <h2>Support & Community</h2>
          </div>
          <p>
            Join Toaster's Rink Discord for support, community discussion, and help with reskins.
          </p>
          <button
            onClick={() => openUrl("https://discord.gg/FTYyruDbbc")}
            className="about-link-button"
          >
            Join Discord Server
          </button>
        </section>

        <section className="about-section">
          <div className="about-section-header">
            <Github size={20} />
            <h2>Open Source</h2>
          </div>
          <p>
            This project is open source on GitHub. Contributions and feedback are welcome!
          </p>
          <button
            onClick={() => openUrl("https://github.com/ckhawks/ReskinPackWorkshop")}
            className="about-link-button"
          >
            View on GitHub
          </button>
        </section>

        <section className="about-section">
          <div className="about-section-header">
            <Heart size={20} />
            <h2>Support Development</h2>
          </div>
          <p>
            If you find this tool useful and want to support continued development, consider buying me a coffee!
          </p>
          <button
            onClick={() => openUrl("https://ko-fi.com/stellaric")}
            className="about-link-button donate"
          >
            Support on Ko-fi
          </button>
        </section>
      </div>
    </div>
  );
}
