/**
 * Управление WebRTC Peer Connections
 */

// STUN серверы (публичные, бесплатные)
const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
}

export interface PeerConnectionConfig {
  playerId: string
  onStream?: (stream: MediaStream) => void
  onIceCandidate?: (candidate: RTCIceCandidate) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
}

export class PeerConnectionManager {
  private peerConnection: RTCPeerConnection
  private playerId: string
  private onStream?: (stream: MediaStream) => void
  private onIceCandidate?: (candidate: RTCIceCandidate) => void
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void

  constructor(config: PeerConnectionConfig) {
    this.playerId = config.playerId
    this.onStream = config.onStream
    this.onIceCandidate = config.onIceCandidate
    this.onConnectionStateChange = config.onConnectionStateChange

    // Создаем peer connection с STUN серверами
    this.peerConnection = new RTCPeerConnection(STUN_SERVERS)

    // Обработка входящих потоков
    this.peerConnection.ontrack = (event) => {
      console.log(`[PeerConnection] Received track event for player ${this.playerId}:`, {
        streams: event.streams.length,
        tracks: event.tracks.length,
        streamId: event.streams[0]?.id,
      })
      if (event.streams[0] && this.onStream) {
        console.log(`[PeerConnection] Calling onStream callback for player ${this.playerId}`)
        this.onStream(event.streams[0])
      }
    }

    // Обработка ICE кандидатов
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate)
      }
    }

    // Отслеживание состояния соединения
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState
      console.log(`[PeerConnection] Connection state changed for ${this.playerId}: ${state}`)
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state)
      }
    }

    // Обработка ошибок и состояния ICE
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState
      console.log(`[PeerConnection] ICE connection state changed for ${this.playerId}: ${state}`)
      if (state === "failed" || state === "disconnected") {
        console.warn(`[WebRTC] ICE connection state: ${state} for player ${this.playerId}`)
      } else if (state === "connected" || state === "completed") {
        console.log(`[WebRTC] ICE connection established for player ${this.playerId}: ${state}`)
      }
    }
    
    // Отслеживание ICE gathering
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection.iceGatheringState
      console.debug(`[PeerConnection] ICE gathering state for ${this.playerId}: ${state}`)
    }
  }

  /**
   * Добавить локальный поток (видео/аудио) к peer connection
   */
  addLocalStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      if (this.peerConnection.getSenders().find((s) => s.track === track)) {
        return // Трек уже добавлен
      }
      this.peerConnection.addTrack(track, stream)
    })
  }

  /**
   * Удалить локальный поток
   */
  removeLocalStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      const sender = this.peerConnection.getSenders().find((s) => s.track === track)
      if (sender) {
        this.peerConnection.removeTrack(sender)
      }
    })
  }

  /**
   * Создать SDP offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    // Always offer to receive audio/video, even if we don't have local stream
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await this.peerConnection.setLocalDescription(offer)
    console.log(`[PeerConnection] Created offer for ${this.playerId}, local description set`)
    return offer
  }

  /**
   * Обработать входящий SDP offer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    console.log(`[PeerConnection] Handling offer for ${this.playerId}`)
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    // Always answer with offer to receive audio/video
    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await this.peerConnection.setLocalDescription(answer)
    console.log(`[PeerConnection] Created answer for ${this.playerId}, local description set`)
    return answer
  }

  /**
   * Обработать входящий SDP answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  /**
   * Добавить ICE кандидат
   */
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error("[WebRTC] Error adding ICE candidate:", error)
    }
  }

  /**
   * Получить текущее состояние соединения
   */
  getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState
  }

  /**
   * Получить состояние ICE соединения
   */
  getIceConnectionState(): RTCIceConnectionState {
    return this.peerConnection.iceConnectionState
  }

  /**
   * Закрыть соединение
   */
  close() {
    this.peerConnection.close()
  }

  /**
   * Получить peer connection (для расширенного использования)
   */
  getPeerConnection(): RTCPeerConnection {
    return this.peerConnection
  }
}
