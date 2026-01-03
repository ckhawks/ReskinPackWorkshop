const fs = require("fs");
const path = require("path");

// Copy HTML to renderer dist folder
const htmlSource = path.join(__dirname, "public/index.html");
const htmlDest = path.join(__dirname, "dist/renderer/index.html");

fs.copyFileSync(htmlSource, htmlDest);
console.log("Copied index.html to dist/renderer/");
