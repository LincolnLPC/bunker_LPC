/**
 * Генерация самоподписанного HTTPS-сертификата для локальной разработки.
 * Нужен для доступа к камере/микрофону при заходе по LAN (браузер требует secure context).
 *
 * Вариант 1: через OpenSSL (если установлен)
 * Вариант 2: через пакет selfsigned (npm install selfsigned)
 */

const fs = require('fs')
const path = require('path')

const certDir = path.join(__dirname, '..', '.cert')
const keyPath = path.join(certDir, 'key.pem')
const certPath = path.join(certDir, 'cert.pem')

function generateWithOpenSSL() {
  const { execSync } = require('child_process')
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true })
  }
  const subj = '/CN=localhost/O=Local Dev/C=RU'
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "${subj}"`,
      { stdio: 'inherit' }
    )
    return true
  } catch (e) {
    return false
  }
}

async function generateWithSelfsigned() {
  try {
    const selfsigned = require('selfsigned')
    const attrs = [{ name: 'commonName', value: 'localhost' }]
    const pems = await selfsigned.generate(attrs, {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
    })
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true })
    }
    fs.writeFileSync(keyPath, pems.private, 'utf8')
    fs.writeFileSync(certPath, pems.cert, 'utf8')
    return true
  } catch (e) {
    console.error('selfsigned error:', e.message)
    return false
  }
}

async function main() {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('Сертификаты уже есть в .cert/')
    console.log('  Удалите папку .cert и запустите снова для пересоздания.')
    return
  }

  console.log('Генерация самоподписанного HTTPS-сертификата...')
  if (generateWithOpenSSL()) {
    console.log('Готово (OpenSSL). Файлы: .cert/key.pem, .cert/cert.pem')
    return
  }
  console.log('OpenSSL не найден, пробуем selfsigned...')
  if (await generateWithSelfsigned()) {
    console.log('Готово (selfsigned). Файлы: .cert/key.pem, .cert/cert.pem')
    return
  }
  console.error('Установите OpenSSL или пакет selfsigned: npm install selfsigned')
  process.exit(1)
}

main()
