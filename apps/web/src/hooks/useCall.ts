'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  CallMedia,
  getIceServers,
  mediaConstraints,
  newCallId,
} from '@/lib/chat/webrtc';
import { chatApi } from '@/lib/chatApi';

export type CallStatus =
  | 'ringing-out' // yo llamo, esperando que contesten
  | 'ringing-in' // me llaman, esperando que yo conteste
  | 'connecting' // aceptada, negociando WebRTC
  | 'active' // ≥1 par conectado
  | 'ended';

export interface CallState {
  callId: string;
  conversationId: string;
  media: CallMedia;
  role: 'caller' | 'callee';
  status: CallStatus;
  /** Quién inició la llamada (para la tarjeta de entrante). */
  initiatorId?: string;
  endReason?: string;
}

/** Par remoto con su stream (para la rejilla de la llamada en grupo). */
export interface RemotePeer {
  userId: string;
  stream: MediaStream;
}

interface SignalPayload {
  callId?: string;
  fromUserId?: string;
  conversationId?: string;
  media?: CallMedia;
  participants?: string[];
  userId?: string;
  data?: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
}

const RING_TIMEOUT_MS = 45000; // auto-cuelga si nadie contesta

/**
 * Orquesta llamadas WebRTC en MALLA (1:N) sobre el socket del chat. Cada par
 * tiene su propia RTCPeerConnection. El servidor lleva la sala (participantes) y
 * solo retransmite señalización. Regla anti-glare: los participantes EXISTENTES
 * ofertan al recién llegado; el recién llegado solo responde.
 *
 * El INICIADOR registra el historial de la llamada (mensaje `call`) al terminar.
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
  const [remotes, setRemotes] = useState<RemotePeer[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteSetRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<CallState | null>(null);
  const wasActiveRef = useRef(false);
  const activeSinceRef = useRef(0);
  const declinedRef = useRef(false);
  const postedRef = useRef(false);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const emit = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      socket?.emit(event, payload);
    },
    [socket],
  );

  const setRemoteFor = useCallback((userId: string, stream: MediaStream) => {
    setRemotes((prev) => {
      const others = prev.filter((p) => p.userId !== userId);
      return [...others, { userId, stream }];
    });
  }, []);

  const dropPeer = useCallback((userId: string) => {
    const pc = pcsRef.current.get(userId);
    if (pc) {
      try {
        pc.close();
      } catch {
        /* noop */
      }
      pcsRef.current.delete(userId);
    }
    pendingRef.current.delete(userId);
    remoteSetRef.current.delete(userId);
    setRemotes((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  // Registra el historial (solo el iniciador) y limpia todo.
  const cleanup = useCallback((reason?: string) => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    const c = callRef.current;
    if (c && c.role === 'caller' && !postedRef.current) {
      postedRef.current = true;
      const status = wasActiveRef.current
        ? 'completed'
        : declinedRef.current
          ? 'declined'
          : 'missed';
      const durationSec =
        wasActiveRef.current && activeSinceRef.current
          ? Math.round((Date.now() - activeSinceRef.current) / 1000)
          : 0;
      chatApi
        .sendCallLog(c.conversationId, { media: c.media, status, durationSec })
        .catch(() => {});
    }
    for (const pc of pcsRef.current.values()) {
      try {
        pc.close();
      } catch {
        /* noop */
      }
    }
    pcsRef.current.clear();
    pendingRef.current.clear();
    remoteSetRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemotes([]);
    setMicOn(true);
    setCamOn(true);
    setCall((prev) => (prev ? { ...prev, status: 'ended', endReason: reason } : null));
    window.setTimeout(() => {
      setCall((prev) => (prev?.status === 'ended' ? null : prev));
    }, 1500);
  }, []);

  const markActive = useCallback(() => {
    if (!wasActiveRef.current) {
      wasActiveRef.current = true;
      activeSinceRef.current = Date.now();
    }
    setCall((prev) => (prev ? { ...prev, status: 'active' } : prev));
  }, []);

  // Pide cámara/micrófono una sola vez.
  const ensureLocalMedia = useCallback(async (media: CallMedia) => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia(
      mediaConstraints(media),
    );
    localStreamRef.current = stream;
    setLocalStream(stream);
    setMicOn(true);
    setCamOn(media === 'video');
    return stream;
  }, []);

  // Crea (o reutiliza) la conexión hacia un par y le añade mis pistas.
  const getOrCreatePc = useCallback(
    (peerUserId: string) => {
      const existing = pcsRef.current.get(peerUserId);
      if (existing) return existing;
      const c = callRef.current;
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pc.onicecandidate = (e) => {
        if (e.candidate && c) {
          emit('call:signal', {
            conversationId: c.conversationId,
            callId: c.callId,
            toUserId: peerUserId,
            data: { candidate: e.candidate.toJSON() },
          });
        }
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteFor(peerUserId, e.streams[0]);
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') markActive();
        else if (st === 'failed' || st === 'closed') dropPeer(peerUserId);
      };
      const local = localStreamRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));
      pcsRef.current.set(peerUserId, pc);
      return pc;
    },
    [emit, setRemoteFor, markActive, dropPeer],
  );

  const drainCandidates = useCallback(async (userId: string) => {
    const pc = pcsRef.current.get(userId);
    const queued = pendingRef.current.get(userId);
    if (!pc || !queued) return;
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        /* candidato inválido */
      }
    }
    pendingRef.current.delete(userId);
  }, []);

  // ── API pública ────────────────────────────────────────────────────────────

  const startCall = useCallback(
    async (conversationId: string, media: CallMedia) => {
      if (callRef.current || !socket) return;
      const callId = newCallId();
      wasActiveRef.current = false;
      declinedRef.current = false;
      postedRef.current = false;
      setCall({
        callId,
        conversationId,
        media,
        role: 'caller',
        status: 'ringing-out',
        initiatorId: meId,
      });
      try {
        await ensureLocalMedia(media);
        emit('call:invite', { conversationId, callId, media });
        ringTimerRef.current = setTimeout(() => {
          if (!wasActiveRef.current) {
            emit('call:cancel', { conversationId, callId });
            cleanup('Sin respuesta');
          }
        }, RING_TIMEOUT_MS);
      } catch {
        cleanup('No se pudo acceder a la cámara/micrófono');
      }
    },
    [socket, meId, ensureLocalMedia, emit, cleanup],
  );

  const acceptCall = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.role !== 'callee' || c.status !== 'ringing-in') return;
    try {
      await ensureLocalMedia(c.media);
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
      emit('call:join', { conversationId: c.conversationId, callId: c.callId });
    } catch {
      emit('call:reject', { conversationId: c.conversationId, callId: c.callId });
      cleanup('No se pudo acceder a la cámara/micrófono');
    }
  }, [ensureLocalMedia, emit, cleanup]);

  const rejectCall = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    emit('call:reject', { conversationId: c.conversationId, callId: c.callId });
    cleanup('Llamada rechazada');
  }, [emit, cleanup]);

  const hangup = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.role === 'caller' && c.status === 'ringing-out') {
      emit('call:cancel', { conversationId: c.conversationId, callId: c.callId });
    } else {
      emit('call:leave', { callId: c.callId });
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
      if (callRef.current) {
        socket.emit('call:reject', {
          conversationId: p.conversationId,
          callId: p.callId,
        });
        return;
      }
      wasActiveRef.current = false;
      declinedRef.current = false;
      postedRef.current = false;
      setCall({
        callId: p.callId,
        conversationId: p.conversationId,
        media: p.media === 'video' ? 'video' : 'audio',
        role: 'callee',
        status: 'ringing-in',
        initiatorId: p.fromUserId,
      });
    };

    // Soy el recién llegado: me dan la lista (los existentes me ofertan).
    const onParticipants = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId) return;
      setCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
    };

    // Existe un nuevo par y YO ya estaba dentro → le hago la oferta.
    const onPeerJoined = async (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId || !p.userId) return;
      // Alguien contestó → ya no es "sin respuesta".
      if (ringTimerRef.current) {
        clearTimeout(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      setCall((prev) =>
        prev && prev.status === 'ringing-out'
          ? { ...prev, status: 'connecting' }
          : prev,
      );
      const pc = getOrCreatePc(p.userId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', {
          conversationId: c.conversationId,
          callId: c.callId,
          toUserId: p.userId,
          data: { sdp: pc.localDescription },
        });
      } catch {
        /* reintento por renegociación si aplica */
      }
    };

    const onPeerLeft = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId || !p.userId) return;
      dropPeer(p.userId);
      // Si ya no queda nadie y la llamada estaba en curso, termina.
      if (pcsRef.current.size === 0 && (wasActiveRef.current || c.status === 'connecting')) {
        cleanup('Llamada finalizada');
      }
    };

    const onSignal = async (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId || !p.fromUserId || !p.data) return;
      const peer = p.fromUserId;
      const pc = getOrCreatePc(peer);
      try {
        if (p.data.sdp) {
          if (p.data.sdp.type === 'offer') {
            await pc.setRemoteDescription(p.data.sdp);
            remoteSetRef.current.add(peer);
            await drainCandidates(peer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('call:signal', {
              conversationId: c.conversationId,
              callId: c.callId,
              toUserId: peer,
              data: { sdp: pc.localDescription },
            });
          } else if (p.data.sdp.type === 'answer') {
            await pc.setRemoteDescription(p.data.sdp);
            remoteSetRef.current.add(peer);
            await drainCandidates(peer);
          }
        } else if (p.data.candidate) {
          if (remoteSetRef.current.has(peer)) {
            await pc.addIceCandidate(p.data.candidate);
          } else {
            const q = pendingRef.current.get(peer) ?? [];
            q.push(p.data.candidate);
            pendingRef.current.set(peer, q);
          }
        }
      } catch {
        /* señal fuera de orden: tolerar */
      }
    };

    const onRejected = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId || c.role !== 'caller') return;
      // En 1:1 (nadie conectado) termina como "rechazada"; en grupo, informativo.
      if (pcsRef.current.size === 0 && !wasActiveRef.current) {
        declinedRef.current = true;
        cleanup('Llamada rechazada');
      }
    };

    const onCanceled = (p: SignalPayload) => {
      const c = callRef.current;
      if (!c || c.callId !== p.callId) return;
      cleanup('Llamada cancelada');
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:participants', onParticipants);
    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:peer-left', onPeerLeft);
    socket.on('call:signal', onSignal);
    socket.on('call:rejected', onRejected);
    socket.on('call:canceled', onCanceled);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:participants', onParticipants);
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:peer-left', onPeerLeft);
      socket.off('call:signal', onSignal);
      socket.off('call:rejected', onRejected);
      socket.off('call:canceled', onCanceled);
    };
  }, [socket, getOrCreatePc, drainCandidates, dropPeer, cleanup]);

  // Al desmontar: corta medios (sin emitir; el otro lado lo detecta por ICE).
  useEffect(() => {
    return () => {
      for (const pc of pcsRef.current.values()) pc.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    call,
    localStream,
    remotes,
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
