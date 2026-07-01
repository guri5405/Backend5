import { io, Socket } from "socket.io-client";

export const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:5000";

let socket: Socket | null = null;

/**
 * Returns a single shared Socket.IO connection to the signaling server.
 * Created lazily (and only in the browser) so it survives client-side
 * navigation between the join screen and the room screen.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SIGNALING_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
