import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import {
  Peer,
  RoomJoinPayload,
  RoomJoinedPayload,
  RoomPeerJoinedPayload,
  RoomPeerLeftPayload,
  RoomFullPayload,
  RoomLeavePayload,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload,
  HangupPayload,
  HangupBroadcastPayload,
  MediaTogglePayload,
  MediaToggleBroadcastPayload,
  ErrorPayload,
} from "./types";

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const MAX_PEERS_PER_ROOM = 2; // this demo is a 1:1 P2P call, like a two-person Meet/Zoom link

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Simple REST health/status endpoints - useful to sanity-check the server
// from Postman before moving on to the Socket.IO event testing.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

app.get("/rooms/:roomId", (req: Request, res: Response) => {
  const room = rooms.get(req.params.roomId);
  res.json({
    roomId: req.params.roomId,
    peerCount: room ? room.size : 0,
    peers: room ? Array.from(room.values()) : [],
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL === "*" ? "*" : [FRONTEND_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// roomId -> Map<socketId, Peer>
const rooms = new Map<string, Map<string, Peer>>();
// socketId -> roomId, so we can clean up on disconnect
const socketRoom = new Map<string, string>();

function getOrCreateRoom(roomId: string): Map<string, Peer> {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Map<string, Peer>();
    rooms.set(roomId, room);
  }
  return room;
}

function removePeerFromRoom(socketId: string) {
  const roomId = socketRoom.get(socketId);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.delete(socketId);
    if (room.size === 0) {
      rooms.delete(roomId);
    } else {
      const payload: RoomPeerLeftPayload = { socketId };
      io.to(roomId).emit("room:peer-left", payload);
    }
  }
  socketRoom.delete(socketId);
}

io.on("connection", (socket: Socket) => {
  console.log(`[connect] ${socket.id}`);

  // ---- Room lifecycle -----------------------------------------------
  socket.on("room:join", ({ roomId, displayName }: RoomJoinPayload) => {
    if (!roomId || !displayName) {
      const err: ErrorPayload = { message: "roomId and displayName are required" };
      socket.emit("error", err);
      return;
    }

    const room = getOrCreateRoom(roomId);

    if (room.size >= MAX_PEERS_PER_ROOM) {
      const full: RoomFullPayload = {
        roomId,
        message: "This room already has 2 participants. This demo supports 1:1 calls only.",
      };
      socket.emit("room:full", full);
      return;
    }

    const existingPeers: Peer[] = Array.from(room.values());

    room.set(socket.id, { socketId: socket.id, displayName });
    socketRoom.set(socket.id, roomId);
    socket.join(roomId);

    const joined: RoomJoinedPayload = {
      roomId,
      selfId: socket.id,
      peers: existingPeers,
    };
    socket.emit("room:joined", joined);

    const peerJoined: RoomPeerJoinedPayload = { socketId: socket.id, displayName };
    socket.to(roomId).emit("room:peer-joined", peerJoined);

    console.log(`[room:join] ${displayName} (${socket.id}) -> room "${roomId}" (${room.size}/${MAX_PEERS_PER_ROOM})`);
  });

  socket.on("room:leave", ({ roomId }: RoomLeavePayload) => {
    socket.leave(roomId);
    removePeerFromRoom(socket.id);
    console.log(`[room:leave] ${socket.id} left room "${roomId}"`);
  });

  // ---- WebRTC signaling relay ----------------------------------------
  // The server never inspects SDP/ICE contents - it just forwards them
  // to the intended peer by socket id. This is the entire "signaling"
  // responsibility in WebRTC; media itself flows P2P after this handshake.
  socket.on("webrtc:offer", ({ to, from, sdp, displayName }: OfferPayload) => {
    io.to(to).emit("webrtc:offer", { from, sdp, displayName });
    console.log(`[webrtc:offer] ${from} -> ${to}`);
  });

  socket.on("webrtc:answer", ({ to, from, sdp }: AnswerPayload) => {
    io.to(to).emit("webrtc:answer", { from, sdp });
    console.log(`[webrtc:answer] ${from} -> ${to}`);
  });

  socket.on("webrtc:ice-candidate", ({ to, from, candidate }: IceCandidatePayload) => {
    io.to(to).emit("webrtc:ice-candidate", { from, candidate });
    console.log(`[webrtc:ice-candidate] ${from} -> ${to}`);
  });

  // ---- Call controls ---------------------------------------------------
  socket.on("call:hangup", ({ roomId, to }: HangupPayload) => {
    const payload: HangupBroadcastPayload = { from: socket.id };
    if (to) {
      io.to(to).emit("call:hangup", payload);
    } else {
      socket.to(roomId).emit("call:hangup", payload);
    }
    console.log(`[call:hangup] ${socket.id} in room "${roomId}"`);
  });

  socket.on("media:toggle", ({ roomId, kind, enabled }: MediaTogglePayload) => {
    const payload: MediaToggleBroadcastPayload = { roomId, kind, enabled, from: socket.id };
    socket.to(roomId).emit("media:toggle", payload);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    removePeerFromRoom(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`);
});
