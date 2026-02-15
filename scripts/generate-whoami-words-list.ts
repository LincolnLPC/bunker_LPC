/**
 * Генерирует docs/whoami-words-list.txt со списком всех слов для игры "Кто Я?"
 * Запуск: npx tsx scripts/generate-whoami-words-list.ts
 */
import * as fs from "fs"
import * as path from "path"
import { WHOAMI_DEFAULT_WORDS } from "../lib/game/whoami-words"
import { WHOAMI_FAMOUS_PEOPLE } from "../lib/game/whoami-words-famous"

const allWords = [...WHOAMI_DEFAULT_WORDS]
const famousWords = [...WHOAMI_FAMOUS_PEOPLE]
const baseWords = allWords.filter((w) => !famousWords.includes(w))

const outputDir = path.join(process.cwd(), "docs")
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const sortedAll = [...allWords].sort((a, b) => a.localeCompare(b, "ru"))

const content = [
  "# Список всех слов для игры «Кто Я?»",
  "",
  `Всего слов: ${allWords.length}`,
  `- Базовые существительные: ${baseWords.length}`,
  `- Известные личности: ${famousWords.length}`,
  "",
  "---",
  "",
  "## Все слова (по алфавиту)",
  "",
  ...sortedAll.map((w) => w),
  "",
  "---",
  "",
  "## Известные личности",
  "",
  ...famousWords.map((w) => w),
].join("\n")

const mdPath = path.join(outputDir, "whoami-words-list.md")
fs.writeFileSync(mdPath, content, "utf-8")

// Простой txt-файл: по одному слову на строку
const txtContent = sortedAll.join("\n")
const txtPath = path.join(outputDir, "whoami-words-list.txt")
fs.writeFileSync(txtPath, txtContent, "utf-8")

console.log(`Созданы файлы:`)
console.log(`  - ${mdPath} (${allWords.length} слов)`)
console.log(`  - ${txtPath} (${allWords.length} слов)`)
