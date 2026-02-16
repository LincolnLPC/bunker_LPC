#!/usr/bin/env node
/**
 * Copy sticker images from Cursor assets to public/stickers
 * Run: node scripts/copy-stickers.js
 */

const fs = require("fs")
const path = require("path")

const scriptDir = __dirname
const projectRoot = path.join(scriptDir, "..")
const destDir = path.join(projectRoot, "public", "stickers")

// Cursor stores user images here when attached to chat (try both project folder names)
const home = process.env.USERPROFILE || process.env.HOME || ""
const cursorAssetsDirs = [
  path.join(home, ".cursor", "projects", "c-Prog-bunker-online-app", "assets"),
  path.join(home, ".cursor", "projects", "c-bunker-online-app", "assets"),
]

const mapping = [
  [
    "c__Users_Lincoln_AppData_Roaming_Cursor_User_workspaceStorage_875e0a9a130e8e2dc351dbca36945de1_images____-5188b4d4-cb92-40df-b510-f01ea9a54678.png",
    "fox-wise.png",
  ],
  [
    "c__Users_Lincoln_AppData_Roaming_Cursor_User_workspaceStorage_875e0a9a130e8e2dc351dbca36945de1_images________-2d301d9a-bcfc-4214-90bf-480dc406ba4c.png",
    "fox-angry.png",
  ],
  [
    "c__Users_Lincoln_AppData_Roaming_Cursor_User_workspaceStorage_875e0a9a130e8e2dc351dbca36945de1_images___________-dc88ab9b-845c-443e-8c6f-f4f13591fdd5.png",
    "hand-dagger.png",
  ],
  [
    "c__Users_Lincoln_AppData_Roaming_Cursor_User_workspaceStorage_875e0a9a130e8e2dc351dbca36945de1_images_____________-e8cf90a3-389a-43e0-93e4-81545fbd6d7c.png",
    "fox-heart.png",
  ],
  [
    "c__Users_Lincoln_AppData_Roaming_Cursor_User_workspaceStorage_875e0a9a130e8e2dc351dbca36945de1_images_______-5688a524-21a1-49c6-8c08-af3d166717c4.png",
    "fox-peek.png",
  ],
]

// Also check assets relative to project (for workspace layout)
const altAssetsDir = path.join(projectRoot, "assets")

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
  console.log("Created", destDir)
}

const destNames = mapping.map(([, destName]) => destName)

let copied = 0
for (const [srcName, destName] of mapping) {
  const srcPaths = [
    ...cursorAssetsDirs.map((d) => path.join(d, srcName)),
    path.join(altAssetsDir, srcName),
  ]
  const dest = path.join(destDir, destName)

  for (const src of srcPaths) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      console.log("Copied:", destName)
      copied++
      break
    }
  }
}

// Fallback: if no files found by exact names, take first 5 PNGs from any assets folder (in order)
if (copied === 0) {
  const assetsDirsToScan = [...cursorAssetsDirs, altAssetsDir]
  for (const assetDir of assetsDirsToScan) {
    if (!fs.existsSync(assetDir)) continue
    let files = []
    try {
      files = fs.readdirSync(assetDir)
        .filter((f) => f.toLowerCase().endsWith(".png"))
        .sort()
    } catch (_) {}
    if (files.length >= 5) {
      for (let i = 0; i < 5 && i < destNames.length; i++) {
        const src = path.join(assetDir, files[i])
        const dest = path.join(destDir, destNames[i])
        fs.copyFileSync(src, dest)
        console.log("Copied (by order):", destNames[i])
        copied++
      }
      break
    }
  }
}

if (copied === 0) {
  console.log("No sticker sources found. Put 5 PNG images in one of:", cursorAssetsDirs.join(", "), "or run from project with assets/ containing 5 PNGs.")
  process.exit(1)
}
console.log(`Done. Copied ${copied} stickers to public/stickers/`)
