/**
 * Скрипт для мониторинга логов сервера в реальном времени
 * Фильтрует и форматирует логи Socket.io сервера
 * 
 * Запуск: node scripts/monitor-server-logs.js
 * 
 * Примечание: Этот скрипт работает, если сервер запущен в том же терминале
 * или если логи перенаправлены в файл
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')

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

// Фильтры для важных логов
const filters = {
  socketio: /\[SocketIO Server\]/i,
  webrtc: /\[WebRTC\]/i,
  peer: /\[PeerConnection\]/i,
  signaling: /\[SocketIO\]/i,
  error: /error|❌|failed/i,
  success: /✅|success|connected|joined/i,
  signal: /signal|offer|answer|ice-candidate/i,
}

function formatLog(line) {
  // Определить тип лога по содержимому
  let color = colors.reset
  let prefix = ''
  
  if (filters.error.test(line)) {
    color = colors.red
    prefix = '❌ '
  } else if (filters.success.test(line)) {
    color = colors.green
    prefix = '✅ '
  } else if (filters.signal.test(line)) {
    color = colors.cyan
    prefix = '📡 '
  } else if (filters.socketio.test(line) || filters.signaling.test(line)) {
    color = colors.blue
  } else if (filters.webrtc.test(line) || filters.peer.test(line)) {
    color = colors.magenta
  } else {
    color = colors.gray
  }
  
  return `${color}${prefix}${line}${colors.reset}`
}

function shouldShow(line) {
  // Показывать только важные логи
  return (
    filters.socketio.test(line) ||
    filters.webrtc.test(line) ||
    filters.peer.test(line) ||
    filters.signaling.test(line) ||
    filters.error.test(line) ||
    filters.signal.test(line)
  )
}

console.log('🔍 Server Log Monitor')
console.log('='.repeat(60))
console.log('Monitoring Socket.io and WebRTC logs...')
console.log('Press Ctrl+C to stop')
console.log('='.repeat(60))
console.log('')

// Статистика
let stats = {
  total: 0,
  socketio: 0,
  webrtc: 0,
  signals: 0,
  errors: 0,
}

// Читать из stdin (если логи перенаправлены)
if (!process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  rl.on('line', (line) => {
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
    
    if (shouldShow(line)) {
      console.log(formatLog(line))
    }
  })

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
      console.log('')
    }
  }, 30000)
} else {
  // Если запущен в интерактивном режиме, показать инструкции
  console.log(`${colors.yellow}⚠️  This script works best when server logs are piped to it.${colors.reset}`)
  console.log('')
  console.log('Usage examples:')
  console.log('  1. Run server with logs:')
  console.log(`     ${colors.cyan}pnpm dev 2>&1 | node scripts/monitor-server-logs.js${colors.reset}`)
  console.log('')
  console.log('  2. Or use the signaling monitor instead:')
  console.log(`     ${colors.cyan}node scripts/monitor-signaling.js <roomId>${colors.reset}`)
  console.log('')
}

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
  console.log('')
  process.exit(0)
})
