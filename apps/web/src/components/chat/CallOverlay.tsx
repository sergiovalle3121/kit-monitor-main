'use client';

import React, { useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import type { CallState } from '@/hooks/useCall';

interface CallOverlayProps {
  call: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  peerName: string;
  peerInitials: string;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

/** Adjunta un MediaStream a un <video>/<audio> (srcObject, no posible en JSX). */
function useStreamMedia<T extends HTMLMediaElement>(stream: MediaStream | null) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return ref;
}

export function CallOverlay(props: CallOverlayProps) {
  const {
    call,
    localStream,
    remoteStream,
    micOn,
    camOn,
    peerName,
    peerInitials,
    onAccept,
    onReject,
    onHangup,
    onToggleMic,
    onToggleCam,
  } = props;

  const remoteRef = useStreamMedia<HTMLVideoElement>(remoteStream);
  const localRef = useStreamMedia<HTMLVideoElement>(localStream);
  const remoteAudioRef = useStreamMedia<HTMLAudioElement>(remoteStream);
  const isVideo = call.media === 'video';

  // ── Llamada entrante: tarjeta de aceptar/rechazar ──────────────────────────
  if (call.status === 'ringing-in') {
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className={`${glass} w-full max-w-sm rounded-[28px] p-6 text-center`}>
          <Avatar initials={peerInitials} pulse />
          <p className="mt-4 text-lg font-semibold">{peerName}</p>
          <p className="text-sm text-gray-500">
            {isVideo ? 'Videollamada entrante…' : 'Llamada entrante…'}
          </p>
          <div className="mt-8 flex items-center justify-center gap-10">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-1.5"
              aria-label="Rechazar"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                <PhoneOff className="h-7 w-7" />
              </span>
              <span className="text-xs text-gray-500">Rechazar</span>
            </button>
            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-1.5"
              aria-label="Aceptar"
            >
              <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                {isVideo ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
              </span>
              <span className="text-xs text-gray-500">Aceptar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel =
    call.status === 'ringing-out'
      ? 'Llamando…'
      : call.status === 'connecting'
        ? 'Conectando…'
        : call.status === 'active'
          ? isVideo
            ? 'Videollamada en curso'
            : 'Llamada en curso'
          : call.endReason || 'Llamada finalizada';

  const showRemoteVideo = isVideo && call.status === 'active' && !!remoteStream;

  // ── Llamada saliente / en curso / finalizada ───────────────────────────────
  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-gray-950 text-white">
      {/* Video remoto (o avatar para audio / aún sin video) */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Sumidero de audio remoto (siempre, para que se oiga en voz y video). */}
        {remoteStream && call.status !== 'ended' && (
          <audio ref={remoteAudioRef} autoPlay className="hidden" />
        )}

        {showRemoteVideo ? (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar initials={peerInitials} pulse={call.status !== 'ended'} large />
            <p className="text-xl font-semibold">{peerName}</p>
            <p className="text-sm text-white/60">{statusLabel}</p>
          </div>
        )}

        {/* Etiqueta de estado superpuesta cuando hay video remoto */}
        {showRemoteVideo && (
          <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-sm">
            {peerName} · {statusLabel}
          </div>
        )}

        {/* Video local (PiP) */}
        {isVideo && localStream && call.status !== 'ended' && (
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={`absolute bottom-4 right-4 h-40 w-28 rounded-2xl border border-white/20 object-cover shadow-xl ${
              camOn ? '' : 'opacity-30'
            }`}
          />
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-5 p-6">
        {call.status !== 'ended' && (
          <>
            <button
              onClick={onToggleMic}
              aria-label={micOn ? 'Silenciar' : 'Activar micrófono'}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-gray-900'
              }`}
            >
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </button>

            {isVideo && (
              <button
                onClick={onToggleCam}
                aria-label={camOn ? 'Apagar cámara' : 'Encender cámara'}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                  camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-gray-900'
                }`}
              >
                {camOn ? (
                  <Video className="h-6 w-6" />
                ) : (
                  <VideoOff className="h-6 w-6" />
                )}
              </button>
            )}
          </>
        )}

        <button
          onClick={onHangup}
          aria-label="Colgar"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

function Avatar({
  initials,
  pulse,
  large,
}: {
  initials: string;
  pulse?: boolean;
  large?: boolean;
}) {
  return (
    <span className="relative inline-flex">
      {pulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/40" />
      )}
      <span
        className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 font-bold text-white ${
          large ? 'h-28 w-28 text-3xl' : 'h-20 w-20 text-2xl'
        }`}
      >
        {initials}
      </span>
    </span>
  );
}
