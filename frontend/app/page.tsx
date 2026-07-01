"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export default function JoinPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enterRoom(id: string) {
    if (!displayName.trim()) {
      setError("Enter your name first.");
      return;
    }
    const room = id.trim() || randomRoomCode();
    router.push(`/room/${encodeURIComponent(room)}?name=${encodeURIComponent(displayName.trim())}`);
  }

  return (
    <main className="page">
      <div className="signal" aria-hidden="true">
        <span className="bar" style={{ animationDelay: "0ms" }} />
        <span className="bar" style={{ animationDelay: "120ms" }} />
        <span className="bar" style={{ animationDelay: "240ms" }} />
        <span className="bar" style={{ animationDelay: "360ms" }} />
        <span className="bar" style={{ animationDelay: "480ms" }} />
      </div>

      <div className="card">
        <p className="eyebrow">Peer-to-peer video &amp; audio</p>
        <h1>Wavelink</h1>
        <p className="subtitle">
          Two people, one direct connection. No account, no server relaying your video - just you,
          your peer, and the signal between you.
        </p>

        <label className="field">
          <span>Your name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Asha"
            maxLength={40}
          />
        </label>

        <label className="field">
          <span>Room code (leave blank to create one)</span>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g. WAV-42X"
            maxLength={24}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button className="primary" onClick={() => enterRoom(roomId)}>
            {roomId.trim() ? "Join room" : "Start new call"}
          </button>
        </div>

        <p className="hint">Share the room code with one other person so they can join you.</p>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2.5rem;
          padding: 2rem 1.5rem;
        }
        .signal {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 40px;
        }
        .bar {
          width: 6px;
          height: 12px;
          background: var(--accent);
          border-radius: 3px;
          animation: pulse 1.1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { height: 10px; opacity: 0.55; }
          50% { height: 38px; opacity: 1; }
        }
        .card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2.25rem 2rem;
        }
        .eyebrow {
          margin: 0 0 0.4rem;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
        }
        h1 {
          font-family: var(--font-display);
          font-size: 2.1rem;
          margin: 0 0 0.75rem;
          letter-spacing: -0.01em;
        }
        .subtitle {
          color: var(--text-muted);
          font-size: 0.92rem;
          line-height: 1.5;
          margin: 0 0 1.75rem;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-bottom: 1.1rem;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        input {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.7rem 0.85rem;
          color: var(--text-primary);
          font-size: 0.95rem;
        }
        input::placeholder {
          color: #565c66;
        }
        .error {
          color: var(--danger);
          font-size: 0.82rem;
          margin: -0.3rem 0 1rem;
        }
        .actions {
          margin-top: 0.5rem;
        }
        .primary {
          width: 100%;
          background: var(--accent);
          color: #1a0d08;
          border: none;
          border-radius: 10px;
          padding: 0.8rem 1rem;
          font-weight: 600;
          font-size: 0.95rem;
          transition: background 0.15s ease;
        }
        .primary:hover {
          background: var(--accent-hover);
        }
        .hint {
          margin: 1rem 0 0;
          font-size: 0.78rem;
          color: var(--text-muted);
          text-align: center;
        }
      `}</style>
    </main>
  );
}
