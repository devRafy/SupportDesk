import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import { useAuth } from "../lib/auth";
import { Socket } from "socket.io-client";

export function useSocket() {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = getSocket(token);
    setSocket(newSocket);

    return () => {
      // Do not disconnect globally, just cleanup the local reference if needed
    };
  }, [token]);

  return socket;
}
