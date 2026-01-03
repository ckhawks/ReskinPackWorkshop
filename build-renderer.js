const esbuild = require("esbuild");
const path = require("path");

const isDev = process.argv[2] === "dev";

esbuild
  .build({
    entryPoints: [path.join(__dirname, "src/renderer/index.tsx")],
    bundle: true,
    minify: !isDev,
    sourcemap: isDev,
    outfile: path.join(__dirname, "dist/renderer/index.js"),
    loader: {
      ".png": "file",
      ".jpg": "file",
      ".gif": "file",
    },
    external: ["electron", "fs", "path"],
    define: {
      "process.env.NODE_ENV": isDev ? '"development"' : '"production"',
    },
  })
  .catch(() => process.exit(1));
