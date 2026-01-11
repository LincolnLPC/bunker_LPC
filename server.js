/**
 * Custom Next.js server with Socket.io
 * Required for WebRTC signaling
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Создать Socket.io сервер
  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  // Логирование всех событий Socket.io для диагностики
  io.engine.on('connection_error', (err) => {
    console.error(`[SocketIO Server] ❌ Connection error:`, err)
  })

  // Хранилище комнат и игроков
  const rooms = new Map() // roomId -> Set<playerId>
  
  // Буфер сигналов для игроков, которые еще не подключились
  // Структура: roomId -> playerId -> Array<signal>
  const signalBuffers = new Map() // roomId -> Map<playerId, Array<signal>>

  console.log(`[SocketIO Server] 🚀 Socket.io server initialized on path: /api/socket`)

  io.on('connection', (socket) => {
    console.log(`[SocketIO Server] ✅ Client connected: ${socket.id}`, {
      transport: socket.conn.transport.name,
      remoteAddress: socket.handshake.address,
      headers: socket.handshake.headers,
    })

    // Присоединение к комнате
    socket.on('join-room', ({ roomId, playerId }) => {
      console.log(`[SocketIO Server] 📡 Player ${playerId} joining room ${roomId}`)
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set())
      }
      
      rooms.get(roomId).add(playerId)
      socket.join(roomId)
      
      // Сохранить roomId и playerId в socket data
      socket.data.roomId = roomId
      socket.data.playerId = playerId
      
      // Отправить подтверждение
      socket.emit('room-joined', { roomId, playerId })
      
      console.log(`[SocketIO Server] ✅ Player ${playerId} joined room ${roomId}. Room now has ${rooms.get(roomId).size} players`)
      
      // Отправить все накопленные сигналы для этого игрока
      if (signalBuffers.has(roomId)) {
        const roomBuffers = signalBuffers.get(roomId)
        if (roomBuffers && roomBuffers.has(playerId)) {
          const bufferedSignals = roomBuffers.get(playerId)
          console.log(`[SocketIO Server] 📦 Sending ${bufferedSignals.length} buffered signals to ${playerId}`)
          
          // Отправить все накопленные сигналы
          bufferedSignals.forEach((signal) => {
            socket.emit('webrtc-signal', signal)
            console.log(`[SocketIO Server] 📤 Sent buffered ${signal.type} from ${signal.from} to ${playerId}`)
          })
          
          // Очистить буфер для этого игрока
          roomBuffers.delete(playerId)
          if (roomBuffers.size === 0) {
            signalBuffers.delete(roomId)
          }
        }
      }
    })

    // Обработка WebRTC сигналов
    socket.on('webrtc-signal', (signal) => {
      console.log(`[SocketIO Server] 📨 Received signal: ${signal.type} from ${signal.from} to ${signal.to} in room ${signal.roomId}`, {
        signalType: signal.type,
        from: signal.from,
        to: signal.to,
        roomId: signal.roomId,
        hasData: !!signal.data,
        socketId: socket.id,
      })
      
      // Найти все сокеты в комнате
      const room = io.sockets.adapter.rooms.get(signal.roomId)
      if (room) {
        const socketIds = Array.from(room)
        console.log(`[SocketIO Server] 📊 Room ${signal.roomId} has ${room.size} sockets:`, socketIds)
        
        // Найти получателя по playerId
        let targetSocket = null
        for (const sid of socketIds) {
          const s = io.sockets.sockets.get(sid)
          if (s && s.data.playerId === signal.to) {
            targetSocket = s
            break
          }
        }
        
        if (targetSocket) {
          // Отправить сигнал конкретному получателю
          targetSocket.emit('webrtc-signal', signal)
          console.log(`[SocketIO Server] ✅ Signal sent directly to ${signal.to} (socket: ${targetSocket.id})`)
        } else {
          // Получатель еще не подключился - сохранить сигнал в буфер
          if (!signalBuffers.has(signal.roomId)) {
            signalBuffers.set(signal.roomId, new Map())
          }
          const roomBuffers = signalBuffers.get(signal.roomId)
          if (!roomBuffers.has(signal.to)) {
            roomBuffers.set(signal.to, [])
          }
          roomBuffers.get(signal.to).push(signal)
          
          // Ограничить размер буфера (максимум 50 сигналов на игрока)
          const buffer = roomBuffers.get(signal.to)
          if (buffer.length > 50) {
            buffer.shift() // Удалить самый старый сигнал
          }
          
          console.log(`[SocketIO Server] 💾 Buffered ${signal.type} from ${signal.from} to ${signal.to} (buffer size: ${buffer.length})`)
        }
      } else {
        console.warn(`[SocketIO Server] ⚠️ Room ${signal.roomId} not found or empty`)
      }
    })

    // Покидание комнаты
    socket.on('leave-room', ({ roomId, playerId }) => {
      console.log(`[SocketIO Server] 👋 Player ${playerId} leaving room ${roomId}`)
      
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(playerId)
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId)
        }
      }
      
      socket.leave(roomId)
      socket.data.roomId = null
      socket.data.playerId = null
      
      console.log(`[SocketIO Server] ✅ Player ${playerId} left room ${roomId}`)
    })

    // Обработка отключения
    socket.on('disconnect', (reason) => {
      console.log(`[SocketIO Server] ⚠️ Client disconnected: ${socket.id}, reason: ${reason}`)
      
      const roomId = socket.data.roomId
      const playerId = socket.data.playerId
      
      if (roomId && playerId) {
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(playerId)
          if (rooms.get(roomId).size === 0) {
            rooms.delete(roomId)
            // Очистить буфер сигналов для этой комнаты
            signalBuffers.delete(roomId)
          }
        }
        console.log(`[SocketIO Server] ✅ Cleaned up player ${playerId} from room ${roomId}`)
      }
    })
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Socket.io server running on /api/socket`)
    })
})
