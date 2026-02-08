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

// Cursor stores user images here when attached to chat
const cursorAssetsDir = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".cursor",
  "projects",
  "c-bunker-online-app",
  "assets"
)

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

let copied = 0
for (const [srcName, destName] of mapping) {
  const srcPaths = [
    path.join(cursorAssetsDir, srcName),
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

if (copied === 0) {
  console.log("No sticker sources found. Ensure images are in:", cursorAssetsDir)
  process.exit(1)
}
console.log(`Done. Copied ${copied} stickers to public/stickers/`)
