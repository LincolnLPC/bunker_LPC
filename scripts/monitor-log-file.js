/**
 * Скрипт для мониторинга логов из файла в реальном времени
 * Запуск: node scripts/monitor-log-file.js [log-file-path]
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

// Определить файл логов
const LOG_DIR = path.join(__dirname, '..', 'logs')
let logFile = process.argv[2]

// Если файл не указан, использовать последний файл логов
if (!logFile) {
  if (fs.existsSync(LOG_DIR)) {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(LOG_DIR, f),
        time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)
    
    if (files.length > 0) {
      logFile = files[0].path
      console.log(`📄 Using latest log file: ${files[0].name}`)
    }
  }
}

if (!logFile || !fs.existsSync(logFile)) {
  console.error('❌ Log file not found!')
  console.log('\nUsage:')
  console.log('  node scripts/monitor-log-file.js [log-file-path]')
  console.log('\nOr ensure logs directory exists and contains .log files')
  process.exit(1)
}

console.log('🔍 Log File Monitor')
console.log('='.repeat(60))
console.log(`File: ${logFile}`)
console.log('='.repeat(60))
console.log('')

// Фильтры для важных логов
const filters = {
  socketio: /\[SocketIO|\[SocketIO Server\]/i,
  webrtc: /\[WebRTC\]/i,
  peer: /\[PeerConnection\]/i,
  signaling: /\[Signaling\]/i,
  error: /error|❌|failed|ERROR/i,
  success: /✅|success|connected|joined|SUCCESS/i,
  signal: /signal|offer|answer|ice-candidate|ICE/i,
  warning: /⚠️|warning|WARN/i,
}

function formatLog(line) {
  // Убрать префикс времени из файла, если есть
  let cleanLine = line.replace(/^\[STDOUT\]|^\[STDERR\]|^\[ERROR\]/, '').trim()
  cleanLine = cleanLine.replace(/^\d{4}-\d{2}-\d{2}T[\d:.-]+Z\s*-\s*/, '')
  
  // Определить тип лога по содержимому
  let color = colors.reset
  let prefix = ''
  
  if (filters.error.test(cleanLine)) {
    color = colors.red
    prefix = '❌ '
  } else if (filters.success.test(cleanLine)) {
    color = colors.green
    prefix = '✅ '
  } else if (filters.warning.test(cleanLine)) {
    color = colors.yellow
    prefix = '⚠️ '
  } else if (filters.signal.test(cleanLine)) {
    color = colors.cyan
    prefix = '📡 '
  } else if (filters.socketio.test(cleanLine) || filters.signaling.test(cleanLine)) {
    color = colors.blue
  } else if (filters.webrtc.test(cleanLine) || filters.peer.test(cleanLine)) {
    color = colors.magenta
  } else {
    color = colors.gray
  }
  
  return `${color}${prefix}${cleanLine}${colors.reset}`
}

function shouldShow(line) {
  // Показывать только важные логи или все, если указан флаг --all
  const showAll = process.argv.includes('--all')
  if (showAll) return true
  
  return (
    filters.socketio.test(line) ||
    filters.webrtc.test(line) ||
    filters.peer.test(line) ||
    filters.signaling.test(line) ||
    filters.error.test(line) ||
    filters.signal.test(line) ||
    filters.warning.test(line)
  )
}

// Статистика
let stats = {
  total: 0,
  socketio: 0,
  webrtc: 0,
  signals: 0,
  errors: 0,
  warnings: 0,
}

// Читать файл построчно
const fileStream = fs.createReadStream(logFile)
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
})

let isFirstRun = true
let lastPosition = 0

// Функция для мониторинга новых строк
function watchForNewLines() {
  const stats = fs.statSync(logFile)
  if (stats.size > lastPosition) {
    const stream = fs.createReadStream(logFile, {
      start: lastPosition,
      encoding: 'utf8',
    })
    
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Сохранить неполную строку
      
      lines.forEach(line => {
        if (line.trim()) {
          stats.total++
          
          if (filters.socketio.test(line) || filters.signaling.test(line)) {
            stats.socketio++
          }
          if (filters.webrtc.test(line) || filters.peer.test(line)) {
            stats.webrtc++
          }
          if (filters.signal.test(line)) {
            stats.signals++
          }
          if (filters.error.test(line)) {
            stats.errors++
          }
          if (filters.warning.test(line)) {
            stats.warnings++
          }
          
          if (shouldShow(line)) {
            console.log(formatLog(line))
          }
        }
      })
    })
    
    lastPosition = stats.size
  }
}

// Сначала прочитать существующие строки (только последние 50)
if (isFirstRun) {
  const allLines = fs.readFileSync(logFile, 'utf8').split('\n')
  const recentLines = allLines.slice(-50) // Последние 50 строк
  
  console.log(`${colors.yellow}📜 Showing last 50 lines from log file...${colors.reset}\n`)
  
  recentLines.forEach(line => {
    if (line.trim() && shouldShow(line)) {
      console.log(formatLog(line))
    }
  })
  
  lastPosition = fs.statSync(logFile).size
  isFirstRun = false
  
  console.log(`\n${colors.green}👀 Now monitoring for new lines...${colors.reset}\n`)
}

// Мониторить новые строки каждые 500ms
const watchInterval = setInterval(watchForNewLines, 500)

// Вывод статистики каждые 30 секунд
setInterval(() => {
  if (stats.total > 0) {
    console.log('')
    console.log(`${colors.yellow}📊 Statistics:${colors.reset}`)
    console.log(`  Total logs: ${stats.total}`)
    console.log(`  Socket.io: ${stats.socketio}`)
    console.log(`  WebRTC: ${stats.webrtc}`)
    console.log(`  Signals: ${stats.signals}`)
    console.log(`  Errors: ${stats.errors}`)
    console.log(`  Warnings: ${stats.warnings}`)
    console.log('')
  }
}, 30000)

// Обработка завершения
process.on('SIGINT', () => {
  console.log('')
  console.log(`${colors.yellow}👋 Shutting down monitor...${colors.reset}`)
  console.log('')
  console.log(`${colors.yellow}📊 Final Statistics:${colors.reset}`)
  console.log(`  Total logs: ${stats.total}`)
  console.log(`  Socket.io: ${stats.socketio}`)
  console.log(`  WebRTC: ${stats.webrtc}`)
  console.log(`  Signals: ${stats.signals}`)
  console.log(`  Errors: ${stats.errors}`)
  console.log(`  Warnings: ${stats.warnings}`)
  console.log('')
  clearInterval(watchInterval)
  rl.close()
  process.exit(0)
})
