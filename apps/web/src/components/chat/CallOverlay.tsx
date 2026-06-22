'use client';

import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { glass } from '@/lib/glass';
import type { CallState } from '@/hooks/useCall';

export interface OverlayRemote {
  userId: string;
  stream: MediaStream;
  name: string;
  initials: string;
}

interface CallOverlayProps {
  call: CallState;
  localStream: MediaStream | null;
  remotes: OverlayRemote[];
  micOn: boolean;
  camOn: boolean;
  /** Título del encabezado (nombre del par en 1:1, o del canal en grupo). */
  title: string;
  /** Para la tarjeta de llamada entrante. */
  incomingName: string;
  incomingInitials: string;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

/** Adjunta un MediaStream a un <video>/<audio> (srcObject no es posible en JSX). */
function useStreamMedia<T extends HTMLMediaElement>(stream: MediaStream | null) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return ref;
}

function Avatar({
  initials,
  pulse,
  size = 'md',
}: {
  initials: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls =
    size === 'lg'
      ? 'h-28 w-28 text-3xl'
      : size === 'sm'
        ? 'h-16 w-16 text-xl'
        : 'h-20 w-20 text-2xl';
  return (
    <span className="relative inline-flex">
      {pulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/40" />
      )}
      <span
        className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 font-bold text-white ${cls}`}
      >
        {initials}
      </span>
    </span>
  );
}

/** Tile de un participante remoto: video (silenciado) o avatar + audio aparte. */
function RemoteTile({ remote }: { remote: OverlayRemote }) {
  const videoRef = useStreamMedia<HTMLVideoElement>(remote.stream);
  const audioRef = useStreamMedia<HTMLAudioElement>(remote.stream);
  const hasVideo = remote.stream.getVideoTracks().length > 0;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-gray-900">
      <audio ref={audioRef} autoPlay className="hidden" />
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      ) : (
        <Avatar initials={remote.initials} />
      )}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-black/45 px-2 py-0.5 text-xs text-white">
        {remote.name}
      </span>
    </div>
  );
}

export function CallOverlay(props: CallOverlayProps) {
  const {
    call,
    localStream,
    remotes,
    micOn,
    camOn,
    title,
    incomingName,
    incomingInitials,
    onAccept,
    onReject,
    onHangup,
    onToggleMic,
    onToggleCam,
  } = props;

  const localRef = useStreamMedia<HTMLVideoElement>(localStream);
  const isVideo = call.media === 'video';

  // ── Llamada entrante ───────────────────────────────────────────────────────
  if (call.status === 'ringing-in') {
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className={`${glass} w-full max-w-sm rounded-[28px] p-6 text-center`}>
          <Avatar initials={incomingInitials} pulse size="lg" />
          <p className="mt-4 text-lg font-semibold">{incomingName}</p>
          <p className="text-sm text-gray-500">
            {isVideo ? 'Videollamada entrante…' : 'Llamada entrante…'}
          </p>
          <div className="mt-8 flex items-center justify-center gap-10">
            <button onClick={onReject} className="flex flex-col items-center gap-1.5" aria-label="Rechazar">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                <PhoneOff className="h-7 w-7" />
              </span>
              <span className="text-xs text-gray-500">Rechazar</span>
            </button>
            <button onClick={onAccept} className="flex flex-col items-center gap-1.5" aria-label="Aceptar">
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
          ? `${remotes.length + 1} en la llamada`
          : call.endReason || 'Llamada finalizada';

  const gridCols =
    remotes.length <= 1 ? 'grid-cols-1' : remotes.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  // ── Llamada saliente / en curso / finalizada ───────────────────────────────
  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-gray-950 text-white">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{title}</p>
          <p className="text-xs text-white/60">{statusLabel}</p>
        </div>
      </div>

      {/* Área de participantes */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3">
        {remotes.length > 0 ? (
          <div className={`grid h-full w-full gap-3 ${gridCols}`}>
            {remotes.map((r) => (
              <RemoteTile key={r.userId} remote={r} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar initials={incomingInitials || '··'} pulse={call.status !== 'ended'} size="lg" />
            <p className="text-xl font-semibold">{title}</p>
            <p className="text-sm text-white/60">{statusLabel}</p>
          </div>
        )}

        {/* Video local (PiP) */}
        {isVideo && localStream && call.status !== 'ended' && (
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={`absolute bottom-4 right-4 h-36 w-26 rounded-2xl border border-white/20 object-cover shadow-xl ${
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
                {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
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
