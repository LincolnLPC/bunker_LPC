/**
 * Скрипт для мониторинга WebRTC signaling через Socket.io
 * Запуск: node scripts/monitor-signaling.js
 */

const { io } = require('socket.io-client')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const ROOM_ID = process.argv[2] // Передать roomId как аргумент: node scripts/monitor-signaling.js <roomId>

console.log('🔍 WebRTC Signaling Monitor')
console.log('='.repeat(60))
console.log(`Server: ${SERVER_URL}`)
if (ROOM_ID) {
  console.log(`Room ID: ${ROOM_ID}`)
} else {
  console.log('⚠️  No room ID provided. Monitoring all rooms.')
  console.log('   Usage: node scripts/monitor-signaling.js <roomId>')
}
console.log('='.repeat(60))
console.log('')

// Подключиться к Socket.io серверу
const socket = io(SERVER_URL, {
  path: '/api/socket',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
})

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
}

function formatTime() {
  return new Date().toLocaleTimeString('ru-RU', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

function log(type, message, data = null) {
  const time = formatTime()
  const typeColors = {
    'CONNECT': colors.green,
    'DISCONNECT': colors.red,
    'SIGNAL': colors.cyan,
    'ROOM': colors.blue,
    'ERROR': colors.red,
    'INFO': colors.yellow,
  }
  const color = typeColors[type] || colors.reset
  
  console.log(`${colors.bright}[${time}]${colors.reset} ${color}[${type}]${colors.reset} ${message}`)
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

// Обработка подключения
socket.on('connect', () => {
  log('CONNECT', `✅ Connected to server (Socket ID: ${socket.id})`)
  
  // Если указан roomId, присоединиться к комнате
  if (ROOM_ID) {
    socket.emit('join-room', {
      roomId: ROOM_ID,
      playerId: 'monitor-' + Date.now(),
    })
    log('ROOM', `📡 Joining room: ${ROOM_ID}`)
  }
})

// Обработка отключения
socket.on('disconnect', (reason) => {
  log('DISCONNECT', `⚠️  Disconnected: ${reason}`)
})

// Обработка ошибок подключения
socket.on('connect_error', (error) => {
  log('ERROR', `❌ Connection error: ${error.message}`)
})

// Обработка подтверждения присоединения к комнате
socket.on('room-joined', (data) => {
  log('ROOM', `✅ Joined room: ${data.roomId} (Player: ${data.playerId})`, data)
})

// Обработка WebRTC сигналов
socket.on('webrtc-signal', (signal) => {
  const signalInfo = {
    type: signal.type,
    from: signal.from,
    to: signal.to,
    roomId: signal.roomId,
    hasData: !!signal.data,
    dataPreview: signal.data 
      ? (signal.type === 'ice-candidate' 
          ? `candidate: ${signal.data.candidate?.substring(0, 50)}...`
          : `type: ${signal.data.type}, sdp length: ${signal.data.sdp?.length || 0}`)
      : 'null',
  }
  
  log('SIGNAL', `${signal.type.toUpperCase()} from ${signal.from} → ${signal.to}`, signalInfo)
})

// Обработка всех остальных событий (для отладки)
socket.onAny((eventName, ...args) => {
  if (!['connect', 'disconnect', 'connect_error', 'room-joined', 'webrtc-signal'].includes(eventName)) {
    log('INFO', `📨 Event: ${eventName}`, args.length > 0 ? args : null)
  }
})

// Статистика
let stats = {
  signals: 0,
  offers: 0,
  answers: 0,
  iceCandidates: 0,
  errors: 0,
}

socket.on('webrtc-signal', (signal) => {
  stats.signals++
  if (signal.type === 'offer') stats.offers++
  if (signal.type === 'answer') stats.answers++
  if (signal.type === 'ice-candidate') stats.iceCandidates++
})

socket.on('connect_error', () => {
  stats.errors++
})

// Вывод статистики каждые 10 секунд
setInterval(() => {
  if (stats.signals > 0 || stats.errors > 0) {
    console.log('')
    log('INFO', '📊 Statistics:', stats)
    console.log('')
  }
}, 10000)

// Обработка завершения
process.on('SIGINT', () => {
  console.log('')
  log('INFO', '👋 Shutting down monitor...')
  console.log('')
  log('INFO', '📊 Final Statistics:', stats)
  socket.disconnect()
  process.exit(0)
})

console.log('⏳ Waiting for connections...')
console.log('Press Ctrl+C to stop\n')
