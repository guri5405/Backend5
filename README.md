# Wavelink — P2P Video Calling Demo (WebRTC + Socket.IO)

A minimal, professional 1:1 video/audio calling app that demonstrates real
two-way WebRTC communication:

- **Backend**: Node.js + TypeScript + Express + Socket.IO — a *signaling
  server only*. It never touches your audio/video; it just relays the
  handshake messages (offer/answer/ICE candidates) that let two browsers
  find each other.
- **Frontend**: Next.js (App Router) + TypeScript — captures camera/mic,
  runs the `RTCPeerConnection`, and renders the call UI.
- **WebRTC transport**: free public Google STUN servers
  (`stun:stun.l.google.com:19302`) — no paid API keys, no TURN service.
  Once the handshake completes, video/audio flows **directly between the
  two browsers**, not through the server.

```
Browser A                    Signaling Server                  Browser B
   |  room:join                    |                               |
   |------------------------------>|                               |
   |                                |<------------------------------|
   |                                |          room:join            |
   |        room:peer-joined       |                               |
   |<-------------------------------|------------------------------>|
   |                                |                               |
   |  webrtc:offer (SDP)            |                               |
   |------------------------------->|-----------------------------> |
   |                                |         webrtc:answer (SDP)   |
   |<--------------------------------------------------------------|
   |  webrtc:ice-candidate  <---------------------------------->   |
   |                                |                               |
   |========== once ICE completes, media flows P2P (no server) ====|
```

## Project structure

```
webrtc-app/
├── backend/     Node.js + TypeScript signaling server (Express + Socket.IO)
└── frontend/    Next.js + TypeScript call UI
```

## 1. Running the backend

```bash
cd backend
npm install
cp .env.example .env      # edit if needed
npm run dev                # ts-node-dev, hot reload, http://localhost:5000
```

`.env` variables:
| Variable       | Default                 | Purpose                                  |
|----------------|--------------------------|-------------------------------------------|
| `PORT`         | `5000`                   | Signaling server port                     |
| `FRONTEND_URL` | `http://localhost:3000`  | Allowed CORS/Socket.IO origin             |

## 2. Running the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # edit if needed
npm run dev                         # http://localhost:3000
```

`.env.local` variables:
| Variable                     | Default                 | Purpose                        |
|-------------------------------|--------------------------|---------------------------------|
| `NEXT_PUBLIC_SIGNALING_URL`   | `http://localhost:5000` | URL the browser connects to    |

## 3. Trying the two-way call

1. Open `http://localhost:3000` in **two different browser tabs/windows**
   (or two devices on the same network — camera access requires `https://`
   or `localhost`, so for a second physical device use a tunnel like
   `ngrok` pointed at the frontend).
2. Tab A: enter a name, leave room code blank, click **Start new call**.
   Note the generated room code shown in the URL/top bar.
3. Tab B: enter a name, enter the **same room code**, click **Join room**.
4. Both tabs will request camera/mic permission, then automatically
   exchange SDP offer/answer and ICE candidates and connect — you should
   see each other's live video within a couple of seconds.
5. Try **Mute**, **Camera off**, and **End call** on either side and watch
   the other tab react in real time.

---

## 4. Signaling events reference (for Postman testing)

Everything below happens over **Socket.IO**, not plain REST, because a call
needs the server to push messages to a specific browser the moment the
*other* browser sends one (an offer arriving, a peer leaving, etc). Postman
(v10.13+) has a native **Socket.IO request** type that supports this. Two
plain REST endpoints are included too for basic health checks.

### 4a. REST endpoints (use a normal Postman HTTP request)

| Method | URL                                   | Purpose                                   |
|--------|----------------------------------------|--------------------------------------------|
| GET    | `http://localhost:5000/health`         | Server up? Returns `{ status, uptimeSeconds }` |
| GET    | `http://localhost:5000/rooms/:roomId`  | Inspect a room's current peers, e.g. `/rooms/WAV-42X` |

### 4b. Setting up a Socket.IO request in Postman

1. **New → Socket.IO Request**.
2. URL: `ws://localhost:5000` (Postman handles the Socket.IO handshake over
   this automatically — do not use `http://` here).
3. Click **Connect**. You should see `Connected` in the response pane.
4. To send an event: in the **Message** tab, pick event name from the
   dropdown (or type it), set the body type to **JSON**, paste the payload
   from the tables below, then click **Send**.
5. To observe events the server pushes back, open the **Messages** log at
   the bottom — every event Postman receives is listed there with its
   name and payload, live.
6. Open a **second** Socket.IO request tab in Postman (a second
   connection = a second simulated browser) to fully exercise the 2-way
   flow without needing two real browsers.

> Tip: give each Postman Socket.IO tab a name like "Peer A" / "Peer B" so
> you can tell the two simulated clients apart while testing.

### 4c. Client → Server events (you emit these from Postman)

#### `room:join`
Join or create a room. Must be sent first.
```json
{
  "roomId": "WAV-42X",
  "displayName": "Asha"
}
```
**Peer A emits this first.** Server replies to Peer A only with
`room:joined` (see below). No one else is in the room yet, so no
broadcast happens.

**Peer B then emits the same event** with the same `roomId` and a
different `displayName`. Server replies to Peer B with `room:joined`
(now containing Peer A in `peers`), **and** broadcasts `room:peer-joined`
to Peer A.

#### `room:leave`
```json
{ "roomId": "WAV-42X" }
```
Removes you from the room; the other peer receives `room:peer-left`.

#### `webrtc:offer`
Sent by whichever peer just discovered the other is already in the room
(normally the second joiner, driven automatically by the frontend). To
test manually in Postman, copy the `selfId` you got in your own
`room:joined` payload into `from`, and the other peer's `socketId` into
`to`.
```json
{
  "to": "<other peer's socket id>",
  "from": "<your own socket id>",
  "displayName": "Asha",
  "sdp": { "type": "offer", "sdp": "v=0\r\no=- 000 IN IP4 127.0.0.1\r\n...(truncated SDP)" }
}
```
Server relays this verbatim to `to` as a `webrtc:offer` event (see 4d).
For a pure signaling-layer test (no real browser), any non-empty string
for `sdp.sdp` is fine — the server never parses it, it only forwards it.

#### `webrtc:answer`
```json
{
  "to": "<socket id of the peer who sent the offer>",
  "from": "<your own socket id>",
  "sdp": { "type": "answer", "sdp": "v=0\r\no=- 111 IN IP4 127.0.0.1\r\n...(truncated SDP)" }
}
```

#### `webrtc:ice-candidate`
Sent multiple times as each network candidate is discovered.
```json
{
  "to": "<other peer's socket id>",
  "from": "<your own socket id>",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2122260223 192.168.1.15 54321 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

#### `call:hangup`
```json
{ "roomId": "WAV-42X" }
```
Broadcasts `call:hangup` to the other peer in the room. (Optionally add
`"to": "<socket id>"` to target one specific peer instead of the room.)

#### `media:toggle`
Sent when a user mutes their mic or turns off their camera, purely so the
other side can show a "mic muted" / "camera off" indicator.
```json
{ "roomId": "WAV-42X", "kind": "audio", "enabled": false }
```
`kind` is `"audio"` or `"video"`; `enabled` is `true`/`false`.

### 4d. Server → Client events (Postman's "Messages" log shows these)

| Event               | Sent to                    | Payload shape |
|----------------------|-----------------------------|----------------|
| `room:joined`        | The socket that just joined | `{ roomId, selfId, peers: [{ socketId, displayName }] }` |
| `room:peer-joined`   | Everyone else already in the room | `{ socketId, displayName }` |
| `room:peer-left`     | Remaining room members      | `{ socketId }` |
| `room:full`          | The socket that tried to join a full room | `{ roomId, message }` |
| `webrtc:offer`       | The socket named in `to`    | `{ from, displayName?, sdp }` |
| `webrtc:answer`      | The socket named in `to`    | `{ from, sdp }` |
| `webrtc:ice-candidate` | The socket named in `to`  | `{ from, candidate }` |
| `call:hangup`        | The other room member(s)    | `{ from }` |
| `media:toggle`       | The other room member(s)    | `{ roomId, from, kind, enabled }` |
| `error`              | The socket that sent bad data | `{ message }` |

### 4e. A full manual test script (two Postman tabs, no browser needed)

1. **Tab "Peer A"** connects to `ws://localhost:5000`, emits `room:join`
   with `{ "roomId": "TEST-1", "displayName": "Peer A" }`.
   → Peer A's Messages log shows `room:joined` with `peers: []` and a
   `selfId` — copy this id, call it `A_ID`.
2. **Tab "Peer B"** connects, emits `room:join` with
   `{ "roomId": "TEST-1", "displayName": "Peer B" }`.
   → Peer B's log shows `room:joined` with `peers: [{ socketId: A_ID, ... }]`
   and its own `selfId` — copy this, call it `B_ID`.
   → **Peer A's** log now shows `room:peer-joined` with `socketId: B_ID`
   — this is the two-way event trigger: B joining pushed a live event to A.
3. **Tab "Peer B"** emits `webrtc:offer` with
   `{ "to": "A_ID", "from": "B_ID", "sdp": { "type": "offer", "sdp": "test-sdp" } }`.
   → **Peer A's** log receives `webrtc:offer` with `{ from: B_ID, sdp: {...} }`.
4. **Tab "Peer A"** emits `webrtc:answer` with
   `{ "to": "B_ID", "from": "A_ID", "sdp": { "type": "answer", "sdp": "test-sdp-answer" } }`.
   → **Peer B's** log receives `webrtc:answer`.
5. Either tab emits `webrtc:ice-candidate` a few times to see the relay
   work in both directions.
6. **Tab "Peer A"** emits `call:hangup` with `{ "roomId": "TEST-1" }`.
   → **Peer B's** log receives `call:hangup` with `{ from: A_ID }`.

This proves the full two-way signaling contract end-to-end without needing
camera hardware — exactly what the real frontend automates for you.

## Notes and limits

- This demo caps rooms at **2 participants** (a 1:1 call). Extending it to
  group calls means creating one `RTCPeerConnection` per additional peer
  (a full mesh) — the signaling event shapes above already generalize to
  that (they're all peer-to-peer, targeted by `to`/`from`), it's mainly the
  frontend that would need a `Map<socketId, RTCPeerConnection>` instead of
  a single ref.
- Only **STUN** is configured (free). Most networks connect fine with STUN
  alone; symmetric NATs (some corporate/mobile networks) may need a TURN
  relay to succeed reliably — that requires a TURN provider or a
  self-hosted `coturn` instance, which is outside the "free API" scope
  requested here.
- Camera/mic access requires a secure context: `localhost` works without
  HTTPS; any other host needs `https://`.
