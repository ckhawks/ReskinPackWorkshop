import React, { useState, useEffect } from "react";
import { AlertCircle, Trash2, X } from "lucide-react";
import "./ConfirmDialog.css";

interface ConfirmDialogProps {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const isButtonDisabled = secondsRemaining > 0;

  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <div className="confirm-header">
          <div className="confirm-icon-wrapper">
            {isDangerous ? (
              <AlertCircle size={24} className="confirm-icon danger" />
            ) : (
              <AlertCircle size={24} className="confirm-icon" />
            )}
          </div>
          <h2>{title}</h2>
          <button className="confirm-close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="confirm-body">
          <p>{message}</p>
        </div>

        <div className="confirm-actions">
          <button onClick={onCancel} className="confirm-cancel">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isButtonDisabled}
            className={`${isDangerous ? "confirm-danger" : "confirm-action"} ${
              isButtonDisabled ? "disabled" : ""
            }`}
          >
            {isDangerous && <Trash2 size={16} />}
            {confirmText}
            {isButtonDisabled && <span className="countdown"> ({secondsRemaining})</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
