# Changelog

## 1.1.0

### Steam Workshop publishing (new)

Publish straight to the Puck Workshop from inside the app — no separate uploader
tool needed. Works for **reskin packs** (Publish button in the pack editor) and
**generic mod/plugin folders** (new Workshop page — point it at any folder).

- Re-publishing **updates the same item** instead of duplicating it.
- Before updating, it **reads the live name, description, tags and visibility
  from Steam** so your Workshop-website edits aren't overwritten.
- **Preview images** are validated (PNG/JPG/GIF, max 1 MB) with a one-click
  "compress to fit" for oversized ones; stored outside your content so they're
  never uploaded as mod files.
- **Tags** use the official Puck categories (Mod, Resource Pack, Server-sided,
  Client-sided) plus an auto-detected build tag (e.g. `B1153`).
- **Visibility** control, optional **change note**, and a **files-to-upload
  preview** (with sizes and dates) so you can confirm what's being sent.
- **Description editor** with an Edit/Preview toggle for Steam BBCode, a
  formatting toolbar (bold, italic, link, list, heading…), and auto-linked URLs.

### Import from SteamWorkshopUploader (new)

- One-click **import** from the old SteamWorkshopUploader — reads its
  `.workshop.json` files and keeps each item's published file id, so publishing
  here updates your existing Workshop items in place (no duplicates).

### Managing your uploads

- Workshop page lists items as rows with **thumbnails**, sorted by last updated,
  with Edit / View on Steam / stop-tracking actions.
- **Sync all from Steam** refreshes every item's details and ordering in one
  request; you can also **save** an item's details locally to publish later.

### App

- New persistent **top navigation** (Reskin Packs / Workshop / About).
- **Update checker** now reads GitHub Releases directly, showing release notes
  and a download link when a newer version is available.
- Larger default window, plus fixes: correct version display, no scrollbar
  layout shift, correct success/error message colors, and visible About icons.

## 1.0.2

- Added support for rink ice reskins with a 2:1 aspect ratio (width = 2 × height),
  e.g. 8192x4096.
- Rink ice supports higher resolutions than other reskin types.
