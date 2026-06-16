# Reskin Pack Workshop

A desktop application for creating and managing reskin packs for Toaster's Reskin Loader in [Puck](https://store.steampowered.com/app/2994020/Puck/), a hockey game on Steam. Build custom texture packs to personalize sticks, pucks, jerseys, helmets, and more.

## Features

- Create and manage local reskin packs
- Add, replace, and remove reskin textures
- Browse subscribed Steam Workshop reskin packs
- Image validation (PNG format, square dimensions 512-2048px; rink ice uses a 2:1 aspect ratio up to 8192px wide)
- Auto-detection of game installation folder

---

## For Users

### Download

1. Go to the [Releases](https://github.com/ckhawks/ReskinPackWorkshop/releases) page
2. Download the latest `Reskin-Pack-Workshop-x.x.x.exe` file
3. Run the executable - no installation required (portable app)

It is not a code-signed app so you may get a Windows Smartscreen error. It costs money to sign the application (to my knowledge, at least), so feel free to upload the .exe to VirusTotal if you're worried.

### Usage

1. Launch the application
2. Select your Puck game folder (auto-detected if installed via Steam)
3. Create a new reskin pack or edit an existing one
4. Add reskin textures by selecting PNG images (must be square, 512-2048px; rink ice must be 2:1, e.g. 8192x4096)
5. Your reskin packs are saved to the game's `reskinpacks` folder

---

## For Developers

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (included with Node.js)

### Installation

```bash
git clone https://github.com/ckhawks/ReskinPackWorkshop.git
cd reskin-pack-workshop
npm install
```

### Run Locally

Build and start the development environment:

```bash
npm run dev
```

This will:

- Compile TypeScript files
- Bundle the React renderer
- Launch the Electron app with hot-reload support

### Build for Distribution

To create a portable Windows executable:

```bash
npm run dist:portable
```

The built executable will be in the `dist/` folder.

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # IPC handlers, window management
│   └── preload.ts  # Context bridge for renderer
├── renderer/       # React frontend
│   ├── App.tsx     # Root component
│   └── components/ # UI components
├── utils/          # Core logic
│   ├── fileOps.ts  # Pack file operations
│   ├── imageValidation.ts
│   └── workshopScanning.ts
└── types/          # TypeScript definitions
```

### Available Scripts

| Script                  | Description                       |
| ----------------------- | --------------------------------- |
| `npm run dev`           | Build and run in development mode |
| `npm run build`         | Build all (TypeScript + renderer) |
| `npm run build:ts`      | Compile TypeScript only           |
| `npm run dist:portable` | Build portable Windows executable |
| `npm start`             | Run the built app                 |
