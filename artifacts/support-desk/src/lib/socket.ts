import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (token?: string | null): Socket => {
  if (!socket) {
    const url = window.location.origin;
    socket = io(url, {
      path: "/api/socket.io",
      auth: token ? { token } : undefined,
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  } else if (token && (!socket.auth || (socket.auth as any).token !== token)) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
  return socket;
};
