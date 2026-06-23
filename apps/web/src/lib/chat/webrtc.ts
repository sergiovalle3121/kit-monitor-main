/**
 * Configuración WebRTC para las llamadas 1:1 del chat.
 *
 * Por defecto usa STUN público de Google (suficiente para muchas redes). Para
 * redes con NAT estricto/simétrico hace falta un servidor TURN: se configura por
 * variables de entorno públicas (build-time) y, si están presentes, se añade.
 *
 *   NEXT_PUBLIC_TURN_URL=turn:turn.miempresa.com:3478
 *   NEXT_PUBLIC_TURN_USERNAME=usuario
 *   NEXT_PUBLIC_TURN_CREDENTIAL=secreto
 */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export type CallMedia = 'audio' | 'video';

/** Restricciones de getUserMedia según el tipo de llamada. */
export function mediaConstraints(media: CallMedia): MediaStreamConstraints {
  return {
    audio: true,
    video:
      media === 'video'
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
  };
}

/** Genera un id de llamada único (no necesita ser criptográfico). */
export function newCallId(): string {
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ¿El navegador soporta llamadas WebRTC con cámara/micrófono? */
export function callsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** ¿El navegador soporta compartir pantalla (getDisplayMedia)? */
export function screenShareSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!(
      navigator.mediaDevices as
        | (MediaDevices & { getDisplayMedia?: unknown })
        | undefined
    )?.getDisplayMedia
  );
}
