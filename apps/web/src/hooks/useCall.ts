'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  CallMedia,
  getIceServers,
  mediaConstraints,
  newCallId,
} from '@/lib/chat/webrtc';

export type CallStatus =
  | 'ringing-out' // yo llamo, esperando que contesten
  | 'ringing-in' // me llaman, esperando que yo conteste
  | 'connecting' // aceptada, negociando WebRTC
  | 'active' // media conectado
  | 'ended'; // terminó (se desmonta solo)

export interface CallState {
  callId: string;
  conversationId: string;
  peerUserId: string;
  media: CallMedia;
  role: 'caller' | 'callee';
  status: CallStatus;
  /** Motivo del fin, para el mensaje final (rechazada, terminada, error…). */
  endReason?: string;
}

interface SignalPayload {
  callId?: string;
  fromUserId?: string;
  conversationId?: string;
  media?: CallMedia;
  data?: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
}

/**
 * Orquesta llamadas 1:1 WebRTC sobre el socket del chat. El servidor solo
 * retransmite la señalización (offer/answer/ICE + ciclo de vida). Toda la
 * lógica de medios vive aquí. Se apoya en refs para que los handlers del socket
 * lean siempre el estado más reciente (sin closures obsoletos).
 */
export function useCall({
  socket,
  meId,
}: {
  socket: Socket | null;
  meId: string;
}) {
  const [call, setCall] = useState<CallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<CallState | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const emit = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      socket?.emit(event, payload);
    },
    [socket],
  );

  // Limpia medios y conexión. `reason` se conserva para la pantalla final.
  const cleanup = useCallback((reason?: string) => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    try {
      pcRef.current?.close();
    } catch {
      /* noop */
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    remoteSetRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setMicOn(true);
    setCamOn(true);
    setCall((prev) =>
      prev ? { ...prev, status: 'ended', endReason: reason } : null,
    );
    // Desmonta el overlay tras un instante para mostrar el estado final.
    window.setTimeout(() => {
      setCall((prev) => (prev?.status === 'ended' ? null : prev));
    }, 1500);
  }, []);

  // Crea la conexión WebRTC y cablea ICE + tracks remotos.
  const createPeer = useCallback(
    (callId: string, conversationId: string, peerUserId: string) => {
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          emit('call:signal', {
            conversationId,
            callId,
            toUserId: peerUserId,
            data: { candidate: e.candidate.toJSON() },
          });
        }
      };
      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0] ?? null);
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          setCall((prev) => (prev ? { ...prev, status: 'active' } : prev));
        } else if (st === 'failed') {
          cleanup('Conexión perdida');
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [emit, cleanup],
  );

  // Pide cámara/micrófono y agrega las pistas a la conexión.
  const attachLocalMedia = useCallback(
    async (pc: RTCPeerConnection, media: CallMedia) => {
      const stream = await navigator.mediaDevices.getUserMedia(
        mediaConstraints(media),
      );
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setCamOn(media === 'video');
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      return stream;
    },
    [],
  );

  const drainCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* candidato inválido: ignorar */
      }
    }
    pendingCandidatesRef.current = [];
  }, []);

  // ── API pública ────────────────────────────────────────────────────────────

  const startCall = useCallback(
    async (conversationId: string, peerUserId: string, media: CallMedia) => {
      if (callRef.current || !socket) return;
      const callId = newCallId();
      const next: CallState = {
        callId,
        conversationId,
        peerUserId,
        media,
        role: 'caller',
        status: 'ringing-out',
      };
      setCall(next);
      try {
        const pc = createPeer(callId, conversationId, peerUserId);
        await attachLocalMedia(pc, media);
        emit('call:invite', { conversationId, callId, media });
      } catch {
        cleanup('No se pudo acceder a la cámara/micrófono');
      }
    },
    [socket, createPeer, attachLocalMedia, emit, cleanup],
  );

  const acceptCall = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.role !== 'callee' || c.status !== 'ringing-in') return;
    try {
      const pc = createPeer(c.callId, c.conversationId, c.peerUserId);
      await attachLocalMedia(pc, c.media);
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
      emit('call:accept', {
        conversationId: c.conversationId,
        callId: c.callId,
        toUserId: c.peerUserId,
      });
    } catch {
      emit('call:reject', {
        conversationId: c.conversationId,
        callId: c.callId,
        toUserId: c.peerUserId,
      });
      cleanup('No se pudo acceder a la cámara/micrófono');
    }
  }, [createPeer, attachLocalMedia, emit, cleanup]);

  const rejectCall = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    emit('call:reject', {
      conversationId: c.conversationId,
      callId: c.callId,
      toUserId: c.peerUserId,
    });
    cleanup('Llamada rechazada');
  }, [emit, cleanup]);

  const hangup = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.status === 'ringing-out') {
      emit('call:cancel', { conversationId: c.conversationId, callId: c.callId });
    } else {
      emit('call:end', { conversationId: c.conversationId, callId: c.callId });
    }
    cleanup('Llamada finalizada');
  }, [emit, cleanup]);

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const enabled = !s.getAudioTracks().every((t) => t.enabled);
    s.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setMicOn(enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const tracks = s.getVideoTracks();
    if (tracks.length === 0) return;
    const enabled = !tracks.every((t) => t.enabled);
    tracks.forEach((t) => (t.enabled = enabled));
    setCamOn(enabled);
  }, []);

  // ── Señalización entrante ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (p: SignalPayload) => {
      if (!p.callId || !p.fromUserId || !p.conversationId) return;
      // Ya estoy en una llamada → rechazo automático (ocupado).
      if (callRef.current) {
        socket.emit('call:reject', {
          conversationId: p.conversationId,
          callId: p.callId,
          toUserId: p.fromUserId,
        });
        return;
      }
      setCall({
        callId: p.callId,
        conversationId: p.conversationId,
        peerUserId: p.fromUserId,
        media: p.media === 'video' ? 'video' : 'audio',
        role: 'callee',
        status: 'ringing-in',
      });
    };

    const onAccepted = async (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId || c.role !== 'caller') return;
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', {
          conversationId: c.conversationId,
          callId: c.callId,
          toUserId: c.peerUserId,
          data: { sdp: pc.localDescription },
        });
      } catch {
        cleanup('Error al iniciar la llamada');
      }
    };

    const onSignal = async (p: SignalPayload) => {
      const c = callRef.current;
      const pc = pcRef.current;
      if (!c || !pc || c.callId !== p.callId) return;
      const data = p.data;
      if (!data) return;
      try {
        if (data.sdp) {
          if (data.sdp.type === 'offer') {
            await pc.setRemoteDescription(data.sdp);
            remoteSetRef.current = true;
            await drainCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('call:signal', {
              conversationId: c.conversationId,
              callId: c.callId,
              toUserId: c.peerUserId,
              data: { sdp: pc.localDescription },
            });
          } else if (data.sdp.type === 'answer') {
            await pc.setRemoteDescription(data.sdp);
            remoteSetRef.current = true;
            await drainCandidates();
          }
        } else if (data.candidate) {
          if (remoteSetRef.current) {
            await pc.addIceCandidate(data.candidate);
          } else {
            pendingCandidatesRef.current.push(data.candidate);
          }
        }
      } catch {
        /* señal inválida/orden inesperado: tolerar */
      }
    };

    const onRejected = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId) return;
      cleanup('Llamada rechazada');
    };
    const onCanceled = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId) return;
      cleanup('Llamada cancelada');
    };
    const onEnded = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId) return;
      cleanup('Llamada finalizada');
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:signal', onSignal);
    socket.on('call:rejected', onRejected);
    socket.on('call:canceled', onCanceled);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:signal', onSignal);
      socket.off('call:rejected', onRejected);
      socket.off('call:canceled', onCanceled);
      socket.off('call:ended', onEnded);
    };
  }, [socket, drainCandidates, cleanup]);

  // Al desmontar: corta medios (no emite; el otro lado lo detecta por ICE).
  useEffect(() => {
    return () => {
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    call,
    localStream,
    remoteStream,
    micOn,
    camOn,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMic,
    toggleCam,
  };
}
