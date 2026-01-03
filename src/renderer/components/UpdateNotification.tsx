import React from "react";
import "./UpdateNotification.css";

interface UpdateNotificationProps {
  version: string;
  notes?: string;
  downloadUrl: string;
  onDismiss: () => void;
}

export default function UpdateNotification({
  version,
  notes,
  downloadUrl,
  onDismiss,
}: UpdateNotificationProps) {
  return (
    <div className="update-notification">
      <div className="notification-content">
        <span className="notification-icon">📦</span>
        <div className="notification-text">
          <p className="notification-title">
            <strong>Update Available</strong>
          </p>
          <p className="notification-message">
            Version {version} is ready to download.
            {notes && ` ${notes}`}
          </p>
        </div>
        <div className="notification-actions">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="download-button"
          >
            Download
          </a>
          <button onClick={onDismiss} className="dismiss-button">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
