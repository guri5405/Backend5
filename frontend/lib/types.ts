// Mirrors backend/src/types.ts - keep both in sync.

export interface Peer {
  socketId: string;
  displayName: string;
}

export interface RoomJoinedPayload {
  roomId: string;
  selfId: string;
  peers: Peer[];
}

export interface RoomPeerJoinedPayload {
  socketId: string;
  displayName: string;
}

export interface RoomPeerLeftPayload {
  socketId: string;
}

export interface RoomFullPayload {
  roomId: string;
  message: string;
}

export interface OfferInboundPayload {
  from: string;
  displayName?: string;
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerInboundPayload {
  from: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidateInboundPayload {
  from: string;
  candidate: RTCIceCandidateInit;
}

export interface HangupInboundPayload {
  from: string;
}

export interface MediaToggleInboundPayload {
  roomId: string;
  from: string;
  kind: "audio" | "video";
  enabled: boolean;
}

export interface ErrorPayload {
  message: string;
}

export type ConnectionStatus =
  | "idle"
  | "waiting-for-peer"
  | "connecting"
  | "connected"
  | "disconnected"
  | "room-full"
  | "error";
