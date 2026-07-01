/**
 * Shared type definitions for the WebRTC signaling server.
 * These describe every event payload exchanged over Socket.IO
 * between the two peers in a call. Keep this file in sync with
 * the frontend's lib/socket.ts types.
 */

export interface Peer {
  socketId: string;
  displayName: string;
}

/** client -> server: "room:join" */
export interface RoomJoinPayload {
  roomId: string;
  displayName: string;
}

/** server -> client: "room:joined" (sent only to the socket that just joined) */
export interface RoomJoinedPayload {
  roomId: string;
  selfId: string;
  peers: Peer[];
}

/** server -> client: "room:peer-joined" (sent to everyone already in the room) */
export interface RoomPeerJoinedPayload {
  socketId: string;
  displayName: string;
}

/** server -> client: "room:peer-left" */
export interface RoomPeerLeftPayload {
  socketId: string;
}

/** server -> client: "room:full" */
export interface RoomFullPayload {
  roomId: string;
  message: string;
}

/** client -> server: "room:leave" */
export interface RoomLeavePayload {
  roomId: string;
}

/** client -> server: "webrtc:offer" */
export interface OfferPayload {
  to: string;
  from: string;
  displayName?: string;
  sdp: RTCSessionDescriptionLike;
}

/** client -> server: "webrtc:answer" */
export interface AnswerPayload {
  to: string;
  from: string;
  sdp: RTCSessionDescriptionLike;
}

/** client -> server: "webrtc:ice-candidate" */
export interface IceCandidatePayload {
  to: string;
  from: string;
  candidate: RTCIceCandidateLike;
}

/** client -> server: "call:hangup" */
export interface HangupPayload {
  roomId: string;
  to?: string;
}

/** server -> client: "call:hangup" */
export interface HangupBroadcastPayload {
  from: string;
}

/** client -> server & server -> client: "media:toggle" */
export interface MediaTogglePayload {
  roomId: string;
  kind: "audio" | "video";
  enabled: boolean;
}

/** server -> client: "media:toggle" (broadcast form) */
export interface MediaToggleBroadcastPayload extends MediaTogglePayload {
  from: string;
}

/** server -> client: "error" */
export interface ErrorPayload {
  message: string;
}

/**
 * Minimal structural types so this file has no hard dependency on
 * "dom" lib types (the backend runs under Node, not a browser).
 */
export interface RTCSessionDescriptionLike {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

export interface RTCIceCandidateLike {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}
