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
    
    console.log(`[PeerConnection] ✅ Created peer connection for player ${this.playerId}`)

    // Обработка входящих потоков
    this.peerConnection.ontrack = (event) => {
      console.log(`[PeerConnection] 🎥 Received track event for player ${this.playerId}:`, {
        streams: event.streams?.length || 0,
        streamId: event.streams?.[0]?.id,
        trackKind: event.track?.kind,
        trackId: event.track?.id,
        trackEnabled: event.track?.enabled,
        trackReadyState: event.track?.readyState,
        trackLabel: event.track?.label,
        connectionState: this.peerConnection.connectionState,
        iceConnectionState: this.peerConnection.iceConnectionState,
        signalingState: this.peerConnection.signalingState,
        transceivers: this.peerConnection.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          receiverTrack: t.receiver.track ? {
            kind: t.receiver.track.kind,
            id: t.receiver.track.id,
            enabled: t.receiver.track.enabled,
            readyState: t.receiver.track.readyState,
          } : null,
        })),
      })
      
      if (event.streams && event.streams.length > 0 && event.streams[0] && this.onStream) {
        const stream = event.streams[0]
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()
        
        console.log(`[PeerConnection] ✅ Calling onStream callback for player ${this.playerId} with stream:`, {
          streamId: stream.id,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          hasVideo: videoTracks.length > 0,
          hasAudio: audioTracks.length > 0,
          videoEnabled: videoTracks.some(t => t.enabled),
          audioEnabled: audioTracks.some(t => t.enabled),
          allTracks: stream.getTracks().map(t => ({
            id: t.id,
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
            label: t.label,
            muted: t.muted,
          })),
        })
        
        // ВАЖНО: Вызвать callback только если есть хотя бы один активный трек
        if (videoTracks.length > 0 || audioTracks.length > 0) {
          this.onStream(stream)
          console.log(`[PeerConnection] ✅ onStream callback executed for player ${this.playerId}`)
        } else {
          console.warn(`[PeerConnection] ⚠️ Stream has no tracks, not calling callback`)
        }
      } else {
        console.warn(`[PeerConnection] ⚠️ Track event received but no stream or callback:`, {
          hasStreams: event.streams && event.streams.length > 0,
          hasCallback: !!this.onStream,
          streamsLength: event.streams?.length || 0,
          eventStreams: event.streams?.map(s => ({ id: s.id, tracks: s.getTracks().length })) || [],
        })
      }
    }

    // Обработка ICE кандидатов
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        console.log(`[PeerConnection] 🧊 ICE candidate generated for player ${this.playerId}:`, {
          candidate: event.candidate.candidate?.substring(0, 50) || "null",
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        })
        this.onIceCandidate(event.candidate)
      } else if (!event.candidate) {
        console.log(`[PeerConnection] ✅ All ICE candidates gathered for player ${this.playerId}`)
      }
    }

    // Отслеживание состояния соединения
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState
      const iceState = this.peerConnection.iceConnectionState
      const senders = this.peerConnection.getSenders()
      const receivers = this.peerConnection.getReceivers()
      
      console.log(`[PeerConnection] 🔄 Connection state changed for ${this.playerId}:`, {
        connectionState: state,
        iceConnectionState: iceState,
        sendersCount: senders.length,
        receiversCount: receivers.length,
        sendersTracks: senders.map(s => ({ trackId: s.track?.id, kind: s.track?.kind, enabled: s.track?.enabled })),
        receiversTracks: receivers.map(r => ({ trackId: r.track?.id, kind: r.track?.kind, enabled: r.track?.enabled })),
      })
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state)
      }
      
      // Когда соединение установлено, проверить наличие потоков
      if (state === "connected") {
        console.log(`[PeerConnection] ✅ Connection established for ${this.playerId}, checking for streams...`)
        // Проверить, есть ли уже полученные потоки
        const transceivers = this.peerConnection.getTransceivers()
        const receivers = this.peerConnection.getReceivers()
        console.log(`[PeerConnection] Transceivers for ${this.playerId}:`, transceivers.map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          receiverTrack: t.receiver.track ? {
            id: t.receiver.track.id,
            kind: t.receiver.track.kind,
            enabled: t.receiver.track.enabled,
            readyState: t.receiver.track.readyState,
          } : null,
        })))
        
        // Проверить, есть ли треки в receivers, которые еще не были обработаны
        const tracksWithStreams = receivers
          .filter(r => r.track)
          .map(r => {
            // Найти stream для этого трека
            const stream = new MediaStream([r.track!])
            return stream
          })
        
        if (tracksWithStreams.length > 0 && this.onStream) {
          console.log(`[PeerConnection] 📦 Found ${tracksWithStreams.length} tracks after connection established, creating streams...`)
          // Создать stream из всех треков одного типа
          const videoTracks = receivers.filter(r => r.track?.kind === 'video').map(r => r.track!).filter(Boolean)
          const audioTracks = receivers.filter(r => r.track?.kind === 'audio').map(r => r.track!).filter(Boolean)
          
          if (videoTracks.length > 0 || audioTracks.length > 0) {
            const combinedStream = new MediaStream([...videoTracks, ...audioTracks])
            console.log(`[PeerConnection] ✅ Created combined stream from existing tracks for ${this.playerId}:`, {
              streamId: combinedStream.id,
              videoTracks: videoTracks.length,
              audioTracks: audioTracks.length,
            })
            this.onStream(combinedStream)
          }
        }
      }
    }

    // Обработка ошибок и состояния ICE
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState
      const connectionState = this.peerConnection.connectionState
      console.log(`[PeerConnection] 🔄 ICE connection state changed for ${this.playerId}:`, {
        iceState: state,
        connectionState: connectionState,
      })
      if (state === "failed" || state === "disconnected") {
        console.warn(`[WebRTC] ⚠️ ICE connection state: ${state} for player ${this.playerId}`)
      } else if (state === "connected" || state === "completed") {
        console.log(`[WebRTC] ✅ ICE connection established for player ${this.playerId}: ${state}`)
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
      // Проверить, не добавлен ли уже этот трек
      const existingSender = this.peerConnection.getSenders().find((s) => s.track === track)
      if (existingSender) {
        console.log(`[PeerConnection] Track ${track.kind} already added for ${this.playerId}`)
        return // Трек уже добавлен
      }
      
      // Просто добавить трек - это создаст трансивер автоматически
      // Трансивер будет иметь направление sendrecv (отправка локального + прием удаленного)
      this.peerConnection.addTrack(track, stream)
      console.log(`[PeerConnection] ✅ Added ${track.kind} track for ${this.playerId}`, {
        trackId: track.id,
        trackLabel: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
      })
    })
    
    // Логировать состояние трансиверов после добавления
    const transceivers = this.peerConnection.getTransceivers()
    console.log(`[PeerConnection] 📊 Transceivers after adding local stream for ${this.playerId}:`, 
      transceivers.map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrack: t.sender.track ? {
          kind: t.sender.track.kind,
          id: t.sender.track.id,
          enabled: t.sender.track.enabled,
        } : null,
        receiverTrack: t.receiver.track ? {
          kind: t.receiver.track.kind,
          id: t.receiver.track.id,
          enabled: t.receiver.track.enabled,
        } : null,
      }))
    )
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
    // Детальное логирование состояния соединения перед созданием offer
    const signalingState = this.peerConnection.signalingState
    const localDescription = this.peerConnection.localDescription
    const remoteDescription = this.peerConnection.remoteDescription
    const hasLocalDescription = !!localDescription
    const hasRemoteDescription = !!remoteDescription
    const connectionState = this.peerConnection.connectionState
    const iceState = this.peerConnection.iceConnectionState
    const transceivers = this.peerConnection.getTransceivers()
    
    console.log(`[PeerConnection] 🔍 createOffer() called for ${this.playerId}`, {
      signalingState,
      connectionState,
      iceState,
      hasLocalDescription,
      hasRemoteDescription,
      localDescriptionType: localDescription?.type || 'none',
      remoteDescriptionType: remoteDescription?.type || 'none',
      localDescriptionSdp: localDescription?.sdp ? `${localDescription.sdp.substring(0, 100)}...` : 'none',
      remoteDescriptionSdp: remoteDescription?.sdp ? `${remoteDescription.sdp.substring(0, 100)}...` : 'none',
      transceiversCount: transceivers.length,
      transceivers: transceivers.map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrack: t.sender.track ? { kind: t.sender.track.kind, id: t.sender.track.id } : null,
        receiverTrack: t.receiver.track ? { kind: t.receiver.track.kind, id: t.receiver.track.id } : null,
      })),
      stackTrace: new Error().stack?.split('\n').slice(1, 6).join('\n'),
    })
    
    // Можно создавать offer только в состоянии 'stable' и только если negotiation еще не завершена
    // Если у нас уже есть и local и remote description, negotiation завершена, и нельзя создавать новый offer
    if (signalingState !== 'stable') {
      const errorMsg = `Cannot create offer: connection is in '${signalingState}' state, expected 'stable'. Current localDescription: ${localDescription?.type || 'none'}, remoteDescription: ${remoteDescription?.type || 'none'}`
      console.error(`[PeerConnection] ❌ ${errorMsg}`, {
        playerId: this.playerId,
        signalingState,
        connectionState,
        iceState,
        localDescription: localDescription ? { type: localDescription.type, sdpLength: localDescription.sdp?.length } : null,
        remoteDescription: remoteDescription ? { type: remoteDescription.type, sdpLength: remoteDescription.sdp?.length } : null,
      })
      throw new Error(errorMsg)
    }
    
    // Если уже есть local description типа 'offer', нельзя создавать новый offer
    // (это означает, что offer уже был создан и отправлен, но answer еще не получен)
    if (hasLocalDescription && localDescription?.type === 'offer') {
      const errorMsg = `Cannot create offer: local description already set to 'offer'. Waiting for answer. Connection needs to be reset to create a new offer.`
      console.error(`[PeerConnection] ❌ ${errorMsg}`, {
        playerId: this.playerId,
        signalingState,
        connectionState,
        iceState,
        localDescription: localDescription ? { type: localDescription.type, sdpLength: localDescription.sdp?.length } : null,
        remoteDescription: remoteDescription ? { type: remoteDescription.type, sdpLength: remoteDescription.sdp?.length } : null,
      })
      throw new Error(errorMsg)
    }
    
    // Если negotiation уже завершена (есть и local и remote description), нельзя создавать новый offer
    if (hasLocalDescription && hasRemoteDescription) {
      const errorMsg = `Cannot create offer: negotiation already completed. Local: ${localDescription?.type}, Remote: ${remoteDescription?.type}. Connection needs to be reset to create a new offer.`
      console.error(`[PeerConnection] ❌ ${errorMsg}`, {
        playerId: this.playerId,
        signalingState,
        connectionState,
        iceState,
        localDescription: localDescription ? { type: localDescription.type, sdpLength: localDescription.sdp?.length, sdpPreview: localDescription.sdp?.substring(0, 200) } : null,
        remoteDescription: remoteDescription ? { type: remoteDescription.type, sdpLength: remoteDescription.sdp?.length, sdpPreview: remoteDescription.sdp?.substring(0, 200) } : null,
      })
      throw new Error(errorMsg)
    }
    
    // Логировать состояние перед созданием offer
    const transceiversBefore = this.peerConnection.getTransceivers()
    console.log(`[PeerConnection] 📊 Creating offer for ${this.playerId}, signalingState: ${signalingState}, transceivers before:`, 
      transceiversBefore.map(t => ({
        mid: t.mid,
        direction: t.direction,
        senderTrack: t.sender.track?.kind || 'none',
        receiverTrack: t.receiver.track?.kind || 'none',
      }))
    )
    
    // Always offer to receive audio/video, even if we don't have local stream
    console.log(`[PeerConnection] 📤 Calling RTCPeerConnection.createOffer() for ${this.playerId}`)
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    
    console.log(`[PeerConnection] ✅ Offer created for ${this.playerId}`, {
      offerType: offer.type,
      sdpLength: offer.sdp?.length || 0,
      sdpPreview: offer.sdp ? offer.sdp.substring(0, 300) : 'none',
      mlinesCount: (offer.sdp?.match(/^m=/gm) || []).length,
    })
    
    // КРИТИЧНО: Проверить состояние ЕЩЕ РАЗ перед setLocalDescription
    // (состояние могло измениться между проверкой в начале метода и здесь)
    const finalSignalingState = this.peerConnection.signalingState
    const finalLocalDesc = this.peerConnection.localDescription
    const finalRemoteDesc = this.peerConnection.remoteDescription
    const finalHasLocalDesc = !!finalLocalDesc
    const finalHasRemoteDesc = !!finalRemoteDesc
    
    // Логировать состояние перед setLocalDescription
    console.log(`[PeerConnection] 🔄 Setting local description for ${this.playerId}`, {
      currentSignalingState: finalSignalingState,
      currentLocalDescription: finalLocalDesc ? {
        type: finalLocalDesc.type,
        sdpLength: finalLocalDesc.sdp?.length,
        mlinesCount: (finalLocalDesc.sdp?.match(/^m=/gm) || []).length,
      } : null,
      currentRemoteDescription: finalRemoteDesc ? {
        type: finalRemoteDesc.type,
        sdpLength: finalRemoteDesc.sdp?.length,
        mlinesCount: (finalRemoteDesc.sdp?.match(/^m=/gm) || []).length,
      } : null,
      newOfferType: offer.type,
      newOfferSdpLength: offer.sdp?.length,
      newOfferMlinesCount: (offer.sdp?.match(/^m=/gm) || []).length,
    })
    
    // Финальная проверка перед setLocalDescription
    if (finalSignalingState !== 'stable') {
      const errorMsg = `Cannot set local description: connection is in '${finalSignalingState}' state, expected 'stable'`
      console.error(`[PeerConnection] ❌ ${errorMsg}`, {
        playerId: this.playerId,
        signalingState: finalSignalingState,
        localDescription: finalLocalDesc ? { type: finalLocalDesc.type } : null,
        remoteDescription: finalRemoteDesc ? { type: finalRemoteDesc.type } : null,
      })
      throw new Error(errorMsg)
    }
    
    if (finalHasLocalDesc && finalLocalDesc.type === 'offer') {
      const errorMsg = `Cannot set local description: local description already set to 'offer'. Waiting for answer.`
      console.error(`[PeerConnection] ❌ ${errorMsg}`, {
        playerId: this.playerId,
        localDescriptionType: finalLocalDesc.type,
        remoteDescription: finalRemoteDesc ? { type: finalRemoteDesc.type } : null,
      })
      throw new Error(errorMsg)
    }
    
    if (finalHasLocalDesc && finalHasRemoteDesc) {
      const errorMsg = `Cannot set local description: negotiation already completed. Local: ${finalLocalDesc.type}, Remote: ${finalRemoteDesc.type}`
      console.error(`[PeerConnection] ❌ ${errorMsg}`, {
        playerId: this.playerId,
        localDescriptionType: finalLocalDesc.type,
        remoteDescriptionType: finalRemoteDesc.type,
        localMlinesCount: (finalLocalDesc.sdp?.match(/^m=/gm) || []).length,
        remoteMlinesCount: (finalRemoteDesc.sdp?.match(/^m=/gm) || []).length,
        newOfferMlinesCount: (offer.sdp?.match(/^m=/gm) || []).length,
      })
      throw new Error(errorMsg)
    }
    
    try {
      await this.peerConnection.setLocalDescription(offer)
      console.log(`[PeerConnection] ✅ Local description set successfully for ${this.playerId}`, {
        newSignalingState: this.peerConnection.signalingState,
      })
    } catch (error) {
      // Детальное логирование ошибки
      const errorDetails: any = {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        signalingState: this.peerConnection.signalingState,
        connectionState: this.peerConnection.connectionState,
        iceState: this.peerConnection.iceConnectionState,
        currentLocalDescription: this.peerConnection.localDescription ? {
          type: this.peerConnection.localDescription.type,
          sdpLength: this.peerConnection.localDescription.sdp?.length,
          sdpPreview: this.peerConnection.localDescription.sdp?.substring(0, 300),
          mlinesCount: (this.peerConnection.localDescription.sdp?.match(/^m=/gm) || []).length,
          mlines: this.peerConnection.localDescription.sdp?.match(/^m=.*$/gm)?.slice(0, 5) || [],
        } : null,
        currentRemoteDescription: this.peerConnection.remoteDescription ? {
          type: this.peerConnection.remoteDescription.type,
          sdpLength: this.peerConnection.remoteDescription.sdp?.length,
          sdpPreview: this.peerConnection.remoteDescription.sdp?.substring(0, 300),
          mlinesCount: (this.peerConnection.remoteDescription.sdp?.match(/^m=/gm) || []).length,
          mlines: this.peerConnection.remoteDescription.sdp?.match(/^m=.*$/gm)?.slice(0, 5) || [],
        } : null,
        newOfferSdpPreview: offer.sdp?.substring(0, 300),
        newOfferMlinesCount: (offer.sdp?.match(/^m=/gm) || []).length,
        newOfferMlines: offer.sdp?.match(/^m=.*$/gm)?.slice(0, 5) || [],
        transceivers: this.peerConnection.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          senderTrack: t.sender.track ? { kind: t.sender.track.kind, id: t.sender.track.id } : null,
          receiverTrack: t.receiver.track ? { kind: t.receiver.track.kind, id: t.receiver.track.id } : null,
        })),
      }
      
      // Правильно логировать ошибку
      console.error(`[PeerConnection] ❌ Error setting local description for ${this.playerId}:`, errorDetails)
      
      // Дополнительное логирование для отладки
      if (error instanceof DOMException) {
        console.error(`[PeerConnection] ❌ DOMException details:`, {
          name: error.name,
          message: error.message,
          code: error.code,
        })
      } else if (error instanceof Error) {
        console.error(`[PeerConnection] ❌ Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
        })
      } else {
        console.error(`[PeerConnection] ❌ Unknown error type:`, typeof error, error)
      }
      
      // Если это ошибка о порядке m-lines, вывести детальное сравнение
      if (error instanceof Error && error.message.includes('m-lines')) {
        console.error(`[PeerConnection] ❌ M-lines comparison:`, {
          currentLocalMlines: this.peerConnection.localDescription?.sdp?.match(/^m=.*$/gm) || [],
          newOfferMlines: offer.sdp?.match(/^m=.*$/gm) || [],
          currentRemoteMlines: this.peerConnection.remoteDescription?.sdp?.match(/^m=.*$/gm) || [],
        })
      }
      
      throw error
    }
    
    // Логировать состояние после создания offer
    const transceiversAfter = this.peerConnection.getTransceivers()
    console.log(`[PeerConnection] ✅ Created offer for ${this.playerId}`, {
      transceiversCount: transceiversAfter.length,
      transceivers: transceiversAfter.map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrack: t.sender.track?.kind || 'none',
        receiverTrack: t.receiver.track?.kind || 'none',
      })),
      sdpLength: offer.sdp?.length || 0,
    })
    
    return offer
  }

  /**
   * Обработать входящий SDP offer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    console.log(`[PeerConnection] 📥 Handling offer for ${this.playerId}`, {
      offerType: offer.type,
      hasSdp: !!offer.sdp,
      sdpLength: offer.sdp?.length || 0,
    })
    
    // Логировать состояние перед обработкой offer
    const transceiversBefore = this.peerConnection.getTransceivers()
    console.log(`[PeerConnection] 📊 Transceivers before handling offer:`, 
      transceiversBefore.map(t => ({
        mid: t.mid,
        direction: t.direction,
        senderTrack: t.sender.track?.kind || 'none',
        receiverTrack: t.receiver.track?.kind || 'none',
      }))
    )
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    
    // Always answer with offer to receive audio/video
    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await this.peerConnection.setLocalDescription(answer)
    
    // Логировать состояние после создания answer
    const transceiversAfter = this.peerConnection.getTransceivers()
    console.log(`[PeerConnection] ✅ Created answer for ${this.playerId}`, {
      transceiversCount: transceiversAfter.length,
      transceivers: transceiversAfter.map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrack: t.sender.track?.kind || 'none',
        receiverTrack: t.receiver.track?.kind || 'none',
      })),
      sdpLength: answer.sdp?.length || 0,
    })
    
    return answer
  }

  /**
   * Обработать входящий SDP answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    const signalingStateBefore = this.peerConnection.signalingState
    const localDescBefore = this.peerConnection.localDescription
    const remoteDescBefore = this.peerConnection.remoteDescription
    
    console.log(`[PeerConnection] 📥 Handling answer for ${this.playerId}`, {
      answerType: answer.type,
      hasSdp: !!answer.sdp,
      sdpLength: answer.sdp?.length || 0,
      signalingStateBefore,
      localDescriptionBefore: localDescBefore ? { type: localDescBefore.type } : null,
      remoteDescriptionBefore: remoteDescBefore ? { type: remoteDescBefore.type } : null,
    })
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
    
    const signalingStateAfter = this.peerConnection.signalingState
    const localDescAfter = this.peerConnection.localDescription
    const remoteDescAfter = this.peerConnection.remoteDescription
    
    console.log(`[PeerConnection] ✅ Answer handled for ${this.playerId}`, {
      signalingStateAfter,
      localDescriptionAfter: localDescAfter ? { type: localDescAfter.type } : null,
      remoteDescriptionAfter: remoteDescAfter ? { type: remoteDescAfter.type } : null,
      negotiationComplete: !!localDescAfter && !!remoteDescAfter,
    })
    
    // После установки remote description, проверить, есть ли уже полученные треки
    // Это может произойти, если треки были получены до обработки answer
    const receivers = this.peerConnection.getReceivers()
    const tracks = receivers.filter(r => r.track).map(r => r.track!)
    
    if (tracks.length > 0 && this.onStream) {
      console.log(`[PeerConnection] 📦 Found ${tracks.length} tracks after handling answer, creating stream...`)
      const videoTracks = tracks.filter(t => t.kind === 'video')
      const audioTracks = tracks.filter(t => t.kind === 'audio')
      
      if (videoTracks.length > 0 || audioTracks.length > 0) {
        const stream = new MediaStream([...videoTracks, ...audioTracks])
        console.log(`[PeerConnection] ✅ Created stream from existing tracks for ${this.playerId}:`, {
          streamId: stream.id,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
        })
        this.onStream(stream)
      }
    }
    
    console.log(`[PeerConnection] ✅ Answer processed for ${this.playerId}`)
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
