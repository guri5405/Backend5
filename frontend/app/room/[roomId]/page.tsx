"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { createPeerConnection, getLocalMediaStream } from "@/lib/webrtc";
import type {
  RoomJoinedPayload,
  RoomPeerJoinedPayload,
  RoomPeerLeftPayload,
  RoomFullPayload,
  OfferInboundPayload,
  AnswerInboundPayload,
  IceCandidateInboundPayload,
  HangupInboundPayload,
  MediaToggleInboundPayload,
  ConnectionStatus,
} from "@/lib/types";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const roomId = decodeURIComponent(params.roomId);
  const displayName = searchParams.get("name") || "Guest";

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const selfIdRef = useRef<string>("");
  const remotePeerIdRef = useRef<string>("");

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [peerName, setPeerName] = useState<string>("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerMicOn, setPeerMicOn] = useState(true);
  const [peerCamOn, setPeerCamOn] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Setting up your camera and mic...");

  useEffect(() => {
    const socket = getSocket();
    let cancelled = false;

    async function ensurePeerConnection(): Promise<RTCPeerConnection> {
      if (pcRef.current) return pcRef.current;

      const pc = createPeerConnection(
        (candidate) => {
          if (remotePeerIdRef.current) {
            socket.emit("webrtc:ice-candidate", {
              to: remotePeerIdRef.current,
              from: selfIdRef.current,
              candidate,
            });
          }
        },
        (stream) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
          setStatus("connected");
          setStatusMessage("");
        },
        (state) => {
          if (state === "disconnected" || state === "failed" || state === "closed") {
            setStatus("disconnected");
            setStatusMessage("Call ended.");
          }
        }
      );

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });

      pcRef.current = pc;
      return pc;
    }

    async function createAndSendOffer(toSocketId: string) {
      const pc = await ensurePeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", {
        to: toSocketId,
        from: selfIdRef.current,
        displayName,
        sdp: offer,
      });
    }

    async function init() {
      try {
        const stream = await getLocalMediaStream();
        if (cancelled) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        setStatus("error");
        setStatusMessage("Could not access camera/microphone. Check browser permissions.");
        return;
      }

      socket.emit("room:join", { roomId, displayName });
      setStatus("waiting-for-peer");
      setStatusMessage("Waiting for someone to join this room...");
    }

    socket.on("room:joined", async ({ selfId, peers }: RoomJoinedPayload) => {
      selfIdRef.current = selfId;
      if (peers.length > 0) {
        const peer = peers[0];
        remotePeerIdRef.current = peer.socketId;
        setPeerName(peer.displayName);
        setStatus("connecting");
        setStatusMessage(`Calling ${peer.displayName}...`);
        await createAndSendOffer(peer.socketId);
      }
    });

    socket.on("room:peer-joined", ({ socketId, displayName: peerDisplayName }: RoomPeerJoinedPayload) => {
      remotePeerIdRef.current = socketId;
      setPeerName(peerDisplayName);
      setStatus("connecting");
      setStatusMessage(`${peerDisplayName} joined - connecting...`);
      // The peer that just arrived is responsible for sending the offer
      // (handled in their own "room:joined" handler), so we just wait here.
    });

    socket.on("webrtc:offer", async ({ from, sdp, displayName: peerDisplayName }: OfferInboundPayload) => {
      remotePeerIdRef.current = from;
      if (peerDisplayName) setPeerName(peerDisplayName);
      const pc = await ensurePeerConnection();
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: from, from: selfIdRef.current, sdp: answer });
      setStatus("connecting");
      setStatusMessage("Connecting...");
    });

    socket.on("webrtc:answer", async ({ sdp }: AnswerInboundPayload) => {
      const pc = pcRef.current;
      if (pc) await pc.setRemoteDescription(sdp);
    });

    socket.on("webrtc:ice-candidate", async ({ candidate }: IceCandidateInboundPayload) => {
      const pc = pcRef.current;
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("Failed to add ICE candidate", err);
        }
      }
    });

    socket.on("room:peer-left", (_payload: RoomPeerLeftPayload) => {
      setStatus("waiting-for-peer");
      setStatusMessage(`${peerName || "The other person"} left the call.`);
      setPeerName("");
      remotePeerIdRef.current = "";
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      pcRef.current?.close();
      pcRef.current = null;
    });

    socket.on("call:hangup", (_payload: HangupInboundPayload) => {
      setStatus("disconnected");
      setStatusMessage("The other person ended the call.");
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      pcRef.current?.close();
      pcRef.current = null;
    });

    socket.on("media:toggle", ({ kind, enabled }: MediaToggleInboundPayload) => {
      if (kind === "audio") setPeerMicOn(enabled);
      if (kind === "video") setPeerCamOn(enabled);
    });

    socket.on("room:full", (payload: RoomFullPayload) => {
      setStatus("room-full");
      setStatusMessage(payload.message);
    });

    init();

    return () => {
      cancelled = true;
      socket.emit("room:leave", { roomId });
      socket.off("room:joined");
      socket.off("room:peer-joined");
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("room:peer-left");
      socket.off("call:hangup");
      socket.off("media:toggle");
      socket.off("room:full");
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    getSocket().emit("media:toggle", { roomId, kind: "audio", enabled: next });
  }

  function toggleCam() {
    const next = !camOn;
    setCamOn(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    getSocket().emit("media:toggle", { roomId, kind: "video", enabled: next });
  }

  function hangUp() {
    getSocket().emit("call:hangup", { roomId });
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    router.push("/");
  }

  const showOverlay = status !== "connected";

  return (
    <main className="room">
      <header className="topbar">
        <span className="room-code">Room <strong>{roomId}</strong></span>
        <span className={`status-pill ${status}`}>{statusLabel(status)}</span>
      </header>

      <div className="stage">
        <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
        {showOverlay && (
          <div className="overlay">
            <div className="pulse" aria-hidden="true" />
            <p>{statusMessage}</p>
            {status === "waiting-for-peer" && (
              <p className="share-hint">Share room code <strong>{roomId}</strong> with the other person</p>
            )}
          </div>
        )}
        {!peerCamOn && status === "connected" && (
          <div className="cam-off-badge">{peerName || "Peer"}'s camera is off</div>
        )}

        <div className="local-tile">
          <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
          {!camOn && <div className="cam-off-local">Camera off</div>}
          <span className="local-label">You{!micOn ? " (muted)" : ""}</span>
        </div>
      </div>

      <div className="controls">
        <button className={`ctrl ${micOn ? "" : "off"}`} onClick={toggleMic} aria-pressed={!micOn}>
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button className={`ctrl ${camOn ? "" : "off"}`} onClick={toggleCam} aria-pressed={!camOn}>
          {camOn ? "Camera off" : "Camera on"}
        </button>
        <button className="ctrl hangup" onClick={hangUp}>
          End call
        </button>
      </div>

      <style jsx>{`
        .room {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--ink);
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .room-code strong {
          color: var(--text-primary);
          font-family: var(--font-display);
          letter-spacing: 0.02em;
        }
        .status-pill {
          padding: 0.3rem 0.7rem;
          border-radius: 999px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          font-size: 0.75rem;
        }
        .status-pill.connected {
          color: var(--live);
          border-color: var(--live);
        }
        .stage {
          position: relative;
          flex: 1;
          margin: 0 1.5rem;
          border-radius: 20px;
          overflow: hidden;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .remote-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: radial-gradient(circle at center, rgba(21, 24, 29, 0.4), rgba(11, 13, 16, 0.92));
          text-align: center;
          padding: 1rem;
        }
        .pulse {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid var(--accent);
          animation: expand 1.8s ease-out infinite;
        }
        @keyframes expand {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .overlay p {
          margin: 0;
          color: var(--text-primary);
          font-size: 0.95rem;
        }
        .share-hint {
          color: var(--text-muted) !important;
          font-size: 0.82rem !important;
        }
        .cam-off-badge {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(21, 24, 29, 0.85);
          border: 1px solid var(--border);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          font-size: 0.8rem;
        }
        .local-tile {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          width: 180px;
          aspect-ratio: 4/3;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .local-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .cam-off-local {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          background: var(--surface);
        }
        .local-label {
          position: absolute;
          bottom: 0.4rem;
          left: 0.5rem;
          font-size: 0.7rem;
          background: rgba(11, 13, 16, 0.6);
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
        }
        .controls {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          padding: 1.5rem;
        }
        .ctrl {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 0.7rem 1.2rem;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 500;
          transition: background 0.15s ease;
        }
        .ctrl:hover {
          background: #262b33;
        }
        .ctrl.off {
          border-color: var(--accent);
          color: var(--accent);
        }
        .ctrl.hangup {
          background: var(--danger);
          border-color: var(--danger);
          color: #fff;
        }
        .ctrl.hangup:hover {
          background: var(--danger-hover);
        }
      `}</style>
    </main>
  );
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case "idle":
      return "Starting...";
    case "waiting-for-peer":
      return "Waiting for peer";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Live";
    case "disconnected":
      return "Call ended";
    case "room-full":
      return "Room full";
    case "error":
      return "Error";
    default:
      return "";
  }
}
