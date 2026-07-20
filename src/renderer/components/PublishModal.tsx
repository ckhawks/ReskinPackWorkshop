import React, { useState, useEffect, useRef } from "react";
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Folder,
  Loader2,
  RefreshCw,
  FileText,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading,
  List,
  Quote,
  Link as LinkIcon,
} from "lucide-react";
import { WorkshopItemRecord, WorkshopVisibility, PreviewValidation } from "../../types";
import {
  WORKSHOP_DEFAULT_TAG,
  WORKSHOP_RESKIN_TAGS,
  WORKSHOP_MOD_TAGS,
} from "../../utils/constants";
import { bbcodeToHtml } from "../bbcode";
import "./PublishModal.css";

interface PublishModalProps {
  gameFolder: string;
  kind: "reskin-pack" | "generic";
  packName?: string;
  existing?: WorkshopItemRecord | null;
  defaultTitle?: string;
  defaultDescription?: string;
  onClose: () => void;
  onPublished?: (record: WorkshopItemRecord) => void;
}

const el = () => (window as any).electron;

/** Stable local id for a new tracked item, kept for the modal's lifetime. */
function makeLocalId(seed: string): string {
  const slug =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item";
  return `${slug}-${Date.now().toString(36)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const VISIBILITY_LABELS: Record<WorkshopVisibility, string> = {
  public: "Public",
  friends: "Friends only",
  private: "Private",
  unlisted: "Unlisted (hidden, accessible by link)",
};

export default function PublishModal({
  gameFolder,
  kind,
  packName,
  existing,
  defaultTitle,
  defaultDescription,
  onClose,
  onPublished,
}: PublishModalProps) {
  const [steamStatus, setSteamStatus] = useState<any>(null);
  const [checkingSteam, setCheckingSteam] = useState(true);

  const [title, setTitle] = useState(existing?.title || defaultTitle || "");
  const [description, setDescription] = useState(
    existing?.description || defaultDescription || ""
  );
  const [tags, setTags] = useState<string[]>(
    existing?.tags && existing.tags.length
      ? existing.tags
      : kind === "reskin-pack"
      ? [WORKSHOP_DEFAULT_TAG]
      : []
  );
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<WorkshopVisibility>(
    existing?.visibility || "public"
  );
  const [changeNote, setChangeNote] = useState("");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [descPreview, setDescPreview] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Wrap the current selection (or insert a placeholder) with BBCode tags.
  function applyBBCode(before: string, after: string, placeholder = "text") {
    const ta = descRef.current;
    if (!ta) {
      setDescription(description + before + placeholder + after);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = description.slice(start, end) || placeholder;
    const next =
      description.slice(0, start) +
      before +
      selected +
      after +
      description.slice(end);
    setDescription(next);
    const selStart = start + before.length;
    const selEnd = selStart + selected.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  const bbButtons = [
    { title: "Bold", icon: <Bold size={15} />, on: () => applyBBCode("[b]", "[/b]") },
    { title: "Italic", icon: <Italic size={15} />, on: () => applyBBCode("[i]", "[/i]") },
    { title: "Underline", icon: <UnderlineIcon size={15} />, on: () => applyBBCode("[u]", "[/u]") },
    { title: "Strikethrough", icon: <Strikethrough size={15} />, on: () => applyBBCode("[strike]", "[/strike]") },
    { title: "Heading", icon: <Heading size={15} />, on: () => applyBBCode("[h2]", "[/h2]", "Heading") },
    { title: "List", icon: <List size={15} />, on: () => applyBBCode("[list]\n[*] ", "\n[/list]", "item") },
    { title: "Quote", icon: <Quote size={15} />, on: () => applyBBCode("[quote]", "[/quote]") },
    { title: "Link", icon: <LinkIcon size={15} />, on: () => applyBBCode("[url=https://]", "[/url]", "link text") },
  ];

  const [contentPath, setContentPath] = useState<string | null>(
    kind === "generic" ? existing?.contentPath || null : null
  );

  const [previewPath, setPreviewPath] = useState<string | null>(
    existing?.previewPath || null
  );
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<PreviewValidation | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  // When a chosen preview is over Steam's 1MB limit, we surface it here and let
  // the user explicitly choose to compress it (rather than doing it silently).
  const [oversize, setOversize] = useState<{ source: string; mb: string } | null>(
    null
  );
  const [compressing, setCompressing] = useState(false);

  const [loadingLive, setLoadingLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveOk, setLiveOk] = useState(true);
  const [contentFiles, setContentFiles] = useState<any>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // The folder that will actually be uploaded: the pack folder for reskin packs,
  // or the chosen folder for generic uploads.
  const resolvedContentPath =
    kind === "reskin-pack"
      ? packName
        ? `${gameFolder}/reskinpacks/${packName}`
        : null
      : contentPath;
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const isUpdate = !!existing?.publishedFileId;
  // A stable id for this item, whether it's new or existing, so a local Save and
  // a later Publish target the same registry record (no duplicates).
  const [localId] = useState(
    () => existing?.localId || makeLocalId(packName || defaultTitle || "item")
  );
  const [saving, setSaving] = useState(false);
  const previewKeySeed = localId;

  useEffect(() => {
    checkSteam();
    el()
      .workshopDetectBuildId(gameFolder)
      .then((id: string | null) => setBuildId(id))
      .catch(() => {});
    if (existing?.previewPath) loadPreviewSrc(existing.previewPath);
    if (isUpdate) loadLiveMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the list of files that will be uploaded whenever the folder changes.
  useEffect(() => {
    if (!resolvedContentPath) {
      setContentFiles(null);
      return;
    }
    setLoadingFiles(true);
    el()
      .workshopListContentFiles(resolvedContentPath)
      .then((res: any) => setContentFiles(res))
      .catch(() => setContentFiles(null))
      .finally(() => setLoadingFiles(false));
  }, [resolvedContentPath]);

  async function checkSteam() {
    setCheckingSteam(true);
    try {
      const status = await el().workshopGetSteamStatus();
      setSteamStatus(status);
    } catch (e) {
      setSteamStatus({ available: false, error: String(e) });
    } finally {
      setCheckingSteam(false);
    }
  }

  // On update, edit *from* what's live on Steam so we never clobber changes made
  // on the Workshop website.
  async function loadLiveMetadata() {
    if (!existing?.publishedFileId) return;
    setLoadingLive(true);
    setLiveStatus(null);
    try {
      const live = await el().workshopGetLiveMetadata(existing.publishedFileId);
      if (live) {
        setTitle(live.title || title);
        setDescription(live.description || description);
        if (live.tags && live.tags.length) setTags(live.tags);
        if (live.visibility) setVisibility(live.visibility);
        setLiveStatus("Loaded the current details from Steam.");
        setLiveOk(true);
        // Cache the current Steam values (name included) back into the registry
        // so the item list reflects the real name, not a stale imported one.
        if (existing) {
          el().workshopSaveItem({
            ...existing,
            title: live.title || existing.title,
            description: live.description ?? existing.description,
            tags: live.tags && live.tags.length ? live.tags : existing.tags,
            visibility: live.visibility || existing.visibility,
            lastPublishedAt: live.timeUpdated
              ? live.timeUpdated * 1000
              : existing.lastPublishedAt,
          });
        }
      } else {
        setLiveStatus(
          "Couldn't read this item from Steam (is Steam running and is this your item?). Keeping your local details."
        );
        setLiveOk(false);
      }
    } catch (e) {
      console.error("Failed to load live metadata", e);
      setLiveStatus("Couldn't reach Steam. Keeping your local details.");
      setLiveOk(false);
    } finally {
      setLoadingLive(false);
    }
  }

  async function loadPreviewSrc(p: string) {
    try {
      const dataUrl = await el().readImageAsDataUrl(p);
      setPreviewSrc(dataUrl);
    } catch {
      setPreviewSrc(null);
    }
  }

  async function pickPreview() {
    setPreviewNote(null);
    setOversize(null);
    const source = await el().workshopSelectPreview();
    if (!source) return;
    const validation: PreviewValidation = await el().workshopValidatePreview(
      source
    );
    setPreviewInfo(validation);

    if (validation.valid) {
      await storePreview(source, false);
      return;
    }

    if (validation.canRecompress) {
      // Surface the problem and let the user decide to compress it.
      const mb = validation.sizeBytes
        ? (validation.sizeBytes / (1024 * 1024)).toFixed(2)
        : "?";
      setOversize({ source, mb });
      return;
    }
    // Not recompressable (e.g. wrong format): errors are shown from previewInfo.
  }

  async function compressOversize() {
    if (!oversize) return;
    setCompressing(true);
    await storePreview(oversize.source, true);
    setCompressing(false);
    setOversize(null);
  }

  async function storePreview(source: string, recompress: boolean) {
    const res = await el().workshopPreparePreview(
      previewKeySeed,
      source,
      recompress
    );
    if (res.success && res.path) {
      setPreviewPath(res.path);
      loadPreviewSrc(res.path);
      if (res.recompressed) {
        const mb = res.sizeBytes
          ? (res.sizeBytes / (1024 * 1024)).toFixed(2)
          : "?";
        setPreviewNote(`Auto-recompressed to ${mb}MB to fit Steam's limit.`);
      } else {
        setPreviewNote(null);
      }
    } else {
      setPreviewNote(res.error || "Could not prepare the preview image.");
    }
  }

  async function pickContentFolder() {
    const folder = await el().workshopSelectContentFolder();
    if (folder) setContentPath(folder);
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addTagFromInput() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  // Official category tags (Resource Pack is reskin-pack-only, per convention),
  // plus the current Puck build tag (e.g. "B1153") derived from the game.
  const suggestedTags = [
    ...(kind === "reskin-pack" ? WORKSHOP_RESKIN_TAGS : WORKSHOP_MOD_TAGS),
    ...(buildId ? [`B${buildId}`] : []),
  ];

  function canPublish(): boolean {
    if (!steamStatus?.available) return false;
    if (!title.trim()) return false;
    if (kind === "generic" && !contentPath) return false;
    return true;
  }

  // Save edits to the local registry without uploading to Steam.
  async function saveLocal() {
    setError(null);
    setResult(null);
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    try {
      const record = {
        localId,
        kind,
        packName,
        contentPath: contentPath || undefined,
        publishedFileId: existing?.publishedFileId,
        title: title.trim(),
        description,
        tags,
        visibility,
        previewPath: previewPath || undefined,
        lastPublishedAt: existing?.lastPublishedAt,
      };
      const saved = await el().workshopSaveItem(record);
      onPublished?.(saved || record);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function doPublish() {
    setError(null);
    setResult(null);
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    if (kind === "generic" && !contentPath) {
      setError("Select a folder to upload.");
      return;
    }
    setPublishing(true);
    try {
      const req = {
        localId,
        kind,
        packName,
        contentPath: contentPath || undefined,
        gameFolder,
        title: title.trim(),
        description,
        tags,
        visibility,
        previewPath: previewPath || undefined,
        changeNote: changeNote.trim() || undefined,
      };
      const flow = await el().workshopPublish(req);
      setResult(flow.result);
      if (flow.result?.success && flow.record) {
        onPublished?.(flow.record);
      }
      if (flow.result?.needsToAcceptAgreement && flow.result?.url) {
        // The item won't appear publicly until the user accepts the Workshop
        // legal agreement on its page.
        el().openExternalUrl(flow.result.url);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="publish-overlay" onClick={onClose}>
      <div className="publish-modal" onClick={(e) => e.stopPropagation()}>
        <div className="publish-header">
          <h2>
            <UploadCloud size={20} />
            {isUpdate ? "Update Workshop item" : "Publish to Steam Workshop"}
          </h2>
          <button className="publish-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Steam connection banner */}
        <div
          className={`steam-banner ${
            steamStatus?.available ? "ok" : "bad"
          }`}
        >
          {checkingSteam ? (
            <span>
              <Loader2 size={16} className="spin" /> Checking Steam…
            </span>
          ) : steamStatus?.available ? (
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
              <AlertTriangle size={16} /> {steamStatus?.error ||
                "Steam is not connected."}
              <button className="link-button" onClick={checkSteam}>
                Retry
              </button>
            </span>
          )}
        </div>

        <div className="publish-body">
          {isUpdate && (
            <div className="live-note">
              {loadingLive ? (
                <span>
                  <Loader2 size={14} className="spin" /> Loading current Workshop
                  details from Steam…
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="link-button"
                    onClick={loadLiveMetadata}
                  >
                    <RefreshCw size={13} /> Pull latest from Steam
                  </button>
                  {liveStatus && (
                    <span className={`live-status ${liveOk ? "ok" : "err"}`}>
                      {liveStatus}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Content folder (generic uploads only) */}
          {kind === "generic" && (
            <div className="form-group">
              <label>Folder to upload</label>
              <div className="folder-row">
                <input type="text" value={contentPath || ""} readOnly
                  placeholder="No folder selected" />
                <button className="secondary-button" onClick={pickContentFolder}>
                  <Folder size={16} /> Choose…
                </button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="ws-title">Title</label>
            <input
              id="ws-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome pack"
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="ws-desc">Description</label>
              <div className="desc-toggle">
                <button
                  type="button"
                  className={!descPreview ? "on" : ""}
                  onClick={() => setDescPreview(false)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={descPreview ? "on" : ""}
                  onClick={() => setDescPreview(true)}
                >
                  Preview
                </button>
              </div>
            </div>
            {descPreview ? (
              <div
                className="desc-preview"
                dangerouslySetInnerHTML={{
                  __html:
                    bbcodeToHtml(description) ||
                    '<span class="desc-empty">Nothing to preview.</span>',
                }}
              />
            ) : (
              <>
                <div className="bb-toolbar">
                  {bbButtons.map((b) => (
                    <button
                      key={b.title}
                      type="button"
                      title={b.title}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={b.on}
                    >
                      {b.icon}
                    </button>
                  ))}
                </div>
                <textarea
                  id="ws-desc"
                  ref={descRef}
                  value={description}
                  rows={6}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your item. Steam BBCode is supported ([b], [url], [list], [h2]…)."
                />
              </>
            )}
          </div>

          {/* Preview image */}
          <div className="form-group">
            <label>Preview image</label>
            <div className="preview-row">
              <div className="preview-thumb">
                {previewSrc ? (
                  <img src={previewSrc} alt="preview" />
                ) : (
                  <div className="preview-empty">
                    <ImageIcon size={28} />
                  </div>
                )}
              </div>
              <div className="preview-controls">
                <button className="secondary-button" onClick={pickPreview}>
                  <ImageIcon size={16} />
                  {previewPath ? "Change preview" : "Choose preview…"}
                </button>
                <p className="hint">
                  PNG/JPG/GIF, max 1MB. Square looks best. Stored outside your
                  pack, so it's never uploaded as content.
                </p>
                {previewInfo?.warnings?.map((w, i) => (
                  <p key={i} className="warn-text">
                    <AlertTriangle size={13} /> {w}
                  </p>
                ))}
                {previewInfo && !previewInfo.valid &&
                  !previewInfo.canRecompress &&
                  previewInfo.errors?.map((er, i) => (
                    <p key={i} className="err-text">
                      {er}
                    </p>
                  ))}
                {oversize && (
                  <div className="oversize-box">
                    <p className="warn-text">
                      <AlertTriangle size={13} /> That image is {oversize.mb}MB —
                      over Steam's 1MB limit.
                    </p>
                    <div className="oversize-actions">
                      <button
                        className="secondary-button"
                        onClick={compressOversize}
                        disabled={compressing}
                      >
                        {compressing ? (
                          <>
                            <Loader2 size={14} className="spin" /> Compressing…
                          </>
                        ) : (
                          "Compress it to fit"
                        )}
                      </button>
                      <button
                        className="link-button"
                        onClick={pickPreview}
                        disabled={compressing}
                      >
                        Choose a different image
                      </button>
                    </div>
                    <p className="hint">
                      A recompressed copy is stored — your original file is never
                      changed.
                    </p>
                  </div>
                )}
                {previewNote && <p className="ok-text">{previewNote}</p>}
              </div>
            </div>
          </div>

          {/* Files to be uploaded */}
          <div className="form-group">
            <label>
              <FileText size={13} style={{ verticalAlign: "-2px" }} /> Files to
              upload
              {contentFiles
                ? ` — ${contentFiles.totalCount} file${
                    contentFiles.totalCount !== 1 ? "s" : ""
                  }, ${formatBytes(contentFiles.totalBytes)}`
                : ""}
            </label>
            {loadingFiles ? (
              <p className="hint">
                <Loader2 size={13} className="spin" /> Scanning folder…
              </p>
            ) : !resolvedContentPath ? (
              <p className="hint">Select a folder to see what will be uploaded.</p>
            ) : contentFiles && contentFiles.totalCount === 0 ? (
              <p className="warn-text">
                <AlertTriangle size={13} /> This folder is empty — there's nothing
                to upload.
              </p>
            ) : contentFiles ? (
              <div className="file-list">
                {contentFiles.files.map((f: any) => (
                  <div key={f.path} className="file-row" title={f.path}>
                    <span className="file-path">{f.path}</span>
                    <span className="file-modified">{formatDate(f.modified)}</span>
                    <span className="file-size">{formatBytes(f.size)}</span>
                  </div>
                ))}
                {contentFiles.truncated && (
                  <div className="file-row file-more">
                    …and {contentFiles.totalCount - contentFiles.files.length} more
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Tags */}
          <div className="form-group">
            <label>Tags</label>
            <div className="tag-suggestions">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip ${tags.includes(tag) ? "on" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="tag-input-row">
              <input
                type="text"
                value={tagInput}
                placeholder="Add a custom tag…"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTagFromInput();
                  }
                }}
              />
              <button className="secondary-button" onClick={addTagFromInput}>
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="tag-list">
                {tags.map((tag) => (
                  <span key={tag} className="tag-active">
                    {tag}
                    <button onClick={() => removeTag(tag)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="form-group">
            <label htmlFor="ws-vis">Visibility</label>
            <select
              id="ws-vis"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as WorkshopVisibility)
              }
            >
              {(Object.keys(VISIBILITY_LABELS) as WorkshopVisibility[]).map(
                (v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Change note (optional — feeds the item's Steam changelog) */}
          <div className="form-group">
            <label htmlFor="ws-note">Change note (optional)</label>
            <input
              id="ws-note"
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder={
                isUpdate
                  ? "What changed in this update? (shown in the Steam changelog)"
                  : "Notes for this first version (shown in the Steam changelog)"
              }
            />
          </div>

          {error && <div className="publish-error">{error}</div>}

          {/* Result */}
          {result && (
            <div
              className={`publish-result ${
                result.success ? "ok" : "bad"
              }`}
            >
              {result.success ? (
                <>
                  <CheckCircle2 size={16} />
                  <div>
                    <strong>
                      {isUpdate ? "Update published!" : "Published!"}
                    </strong>
                    {result.needsToAcceptAgreement && (
                      <p className="agreement-note">
                        One more step: accept the Steam Workshop legal agreement
                        on the item's page or it stays hidden. We opened it in
                        your browser.
                      </p>
                    )}
                    {result.url && (
                      <button
                        className="link-button"
                        onClick={() => el().openExternalUrl(result.url)}
                      >
                        Open on Steam <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Publish failed</strong>
                    <p>{result.error}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="publish-footer">
          <button className="cancel-button" onClick={onClose}>
            {result?.success ? "Close" : "Cancel"}
          </button>
          <button
            className="cancel-button"
            onClick={saveLocal}
            disabled={saving || publishing || !title.trim()}
            title="Save these details locally without uploading to Steam"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="publish-button"
            onClick={doPublish}
            disabled={!canPublish() || publishing}
          >
            {publishing ? (
              <>
                <Loader2 size={16} className="spin" /> Publishing…
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                {isUpdate ? "Publish update" : "Publish"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
