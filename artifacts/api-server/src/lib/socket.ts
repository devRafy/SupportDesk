import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "./auth.js";
import { logger } from "./logger.js";

let io: Server | null = null;

export function getIo(): Server | null {
  return io;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.on("connection", async (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    let userId: number | null = null;
    let workspaceId: number | null = null;

    if (token) {
      try {
        const payload = verifyToken(token);
        userId = payload.userId;
        workspaceId = payload.workspaceId;
        await db.update(usersTable).set({ isOnline: true }).where(eq(usersTable.id, userId));
        socket.join(`workspace:${workspaceId}`);
        io!.to(`workspace:${workspaceId}`).emit("agent:online", { userId });
        logger.info({ userId, workspaceId }, "Agent connected");
      } catch {
        logger.warn("Invalid socket token");
      }
    }

    socket.on("agent:join", (conversationId: number) => {
      socket.join(`conversation:${conversationId}`);
      logger.info({ conversationId, userId }, "Agent joined conversation");
    });

    socket.on("visitor:join", (conversationId: number) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("agent:typing", ({ conversationId }: { conversationId: number }) => {
      socket.to(`conversation:${conversationId}`).emit("agent:typing", { conversationId });
    });

    socket.on("visitor:typing", ({ conversationId }: { conversationId: number }) => {
      socket.to(`conversation:${conversationId}`).emit("visitor:typing", { conversationId });
    });

    socket.on("disconnect", async () => {
      if (userId && workspaceId) {
        await db.update(usersTable).set({ isOnline: false }).where(eq(usersTable.id, userId));
        io!.to(`workspace:${workspaceId}`).emit("agent:offline", { userId });
        logger.info({ userId }, "Agent disconnected");
      }
    });
  });

  return io;
}
