/**
 * Free, public STUN servers (Google's). STUN is enough to establish a
 * direct P2P connection for most home/office networks. A production app
 * behind strict corporate NATs would add a TURN server too, but that
 * requires a paid/self-hosted relay - out of scope for this free demo.
 */
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onRemoteTrack: (stream: MediaStream) => void,
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };

  pc.ontrack = (event) => {
    onRemoteTrack(event.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange?.(pc.connectionState);
  };

  return pc;
}

export async function getLocalMediaStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720, facingMode: "user" },
    audio: { echoCancellation: true, noiseSuppression: true },
  });
}
