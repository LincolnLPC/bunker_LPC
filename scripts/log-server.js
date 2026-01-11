/**
 * Скрипт для запуска сервера с сохранением логов в файл
 * Запуск: node scripts/log-server.js
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const LOG_DIR = path.join(__dirname, '..', 'logs')
const LOG_FILE = path.join(LOG_DIR, `server-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.log`)

// Создать директорию для логов, если её нет
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  console.log(`📁 Created logs directory: ${LOG_DIR}`)
}

// Открыть файл для записи
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' })

console.log('🚀 Starting server with logging...')
console.log(`📝 Logs will be saved to: ${LOG_FILE}`)
console.log('='.repeat(60))

// Записать заголовок в файл
const header = `\n${'='.repeat(60)}\nServer started at: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`
logStream.write(header)

// Запустить сервер
const server = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
})

// Обработка stdout (обычные логи)
server.stdout.on('data', (data) => {
  const message = data.toString()
  process.stdout.write(message) // Вывести в консоль
  logStream.write(`[STDOUT] ${new Date().toISOString()} - ${message}`) // Сохранить в файл
})

// Обработка stderr (ошибки)
server.stderr.on('data', (data) => {
  const message = data.toString()
  process.stderr.write(message) // Вывести в консоль
  logStream.write(`[STDERR] ${new Date().toISOString()} - ${message}`) // Сохранить в файл
})

// Обработка завершения процесса
server.on('close', (code) => {
  const footer = `\n${'='.repeat(60)}\nServer stopped at: ${new Date().toISOString()} (exit code: ${code})\n${'='.repeat(60)}\n\n`
  logStream.write(footer)
  logStream.end()
  console.log(`\n📝 Logs saved to: ${LOG_FILE}`)
  process.exit(code)
})

// Обработка ошибок
server.on('error', (error) => {
  console.error('❌ Error starting server:', error)
  logStream.write(`[ERROR] ${new Date().toISOString()} - ${error.message}\n`)
  logStream.end()
  process.exit(1)
})

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping server...')
  server.kill('SIGINT')
  setTimeout(() => {
    logStream.end()
    process.exit(0)
  }, 1000)
})

console.log('Press Ctrl+C to stop\n')
