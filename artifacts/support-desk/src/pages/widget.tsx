import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useCreateConversation, useSendMessage, useListMessages, getListMessagesQueryKey } from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MessageSquare, Send, Minimize2 } from "lucide-react";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface PublicWorkspace {
  id: number;
  name: string;
}

export default function Widget() {
  const [, params] = useRoute("/widget/:workspaceId");
  const workspaceId = Number(params?.workspaceId);

  const [workspace, setWorkspace] = useState<PublicWorkspace | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [started, setStarted] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  const createConv = useCreateConversation();
  const sendMsg = useSendMessage();
  const { data: messages } = useListMessages(conversationId!, {
    query: { queryKey: getListMessagesQueryKey(conversationId!), enabled: !!conversationId, refetchInterval: 4000 }
  });

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspace/${workspaceId}/public`)
      .then(r => r.json())
      .then(setWorkspace)
      .catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    if (!conversationId) return;
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.emit("join_conversation", { conversationId });

    socket.on("new_message", () => {
      qc.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
    });

    socket.on("agent_typing", () => {
      setIsTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
    });

    return () => {
      socket.disconnect();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const startChat = (e: React.FormEvent) => {
    e.preventDefault();
    createConv.mutate(
      { data: { workspaceId, visitorName, visitorEmail, sourcePage: document.referrer || window.location.href } },
      { onSuccess: (conv) => { setConversationId(conv.id); setStarted(true); } }
    );
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversationId) return;
    const text = messageText;
    setMessageText("");
    sendMsg.mutate(
      { id: conversationId, data: { content: text, senderType: "visitor", sender: visitorName } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) }) }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-end justify-end p-4">
      {minimized && (
        <button onClick={() => setMinimized(false)} className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform">
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {!minimized && (
        <div className="w-[360px] h-[560px] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
          <div className="bg-primary px-5 py-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{workspace?.name ?? "Support"}</p>
              <p className="text-white/70 text-xs">We usually reply in a few minutes</p>
            </div>
            <button onClick={() => setMinimized(true)} className="text-white/70 hover:text-white transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {!started ? (
            <div className="flex-1 flex flex-col justify-center p-6">
              <h3 className="font-semibold text-base mb-1">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mb-5">We'll get back to you as soon as possible.</p>
              <form onSubmit={startChat} className="space-y-3">
                <Input placeholder="Your name" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} required />
                <Input type="email" placeholder="Your email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} required />
                <Button type="submit" className="w-full" disabled={createConv.isPending}>
                  {createConv.isPending ? "Starting..." : "Start chat"}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages ?? []).map((msg: Message) => {
                  const isVisitor = msg.senderType === "visitor";

                  return (
                    <div key={msg.id} className={cn("flex gap-2", isVisitor ? "flex-row-reverse" : "flex-row")}>
                      {!isVisitor && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1">
                          {msg.sender?.slice(0, 1)?.toUpperCase() ?? "A"}
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                        isVisitor ? "bg-primary text-white rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                      )}>
                        {!isVisitor && (
                          <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                            {msg.sender ?? "Agent"}
                          </p>
                        )}
                        <p>{msg.content}</p>
                        <p className={cn("text-[10px] mt-1 opacity-60", isVisitor ? "text-right" : "text-left")}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] flex-shrink-0">A</div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full typing-dot" />
                        <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full typing-dot" />
                        <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full typing-dot" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2 flex-shrink-0">
                <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type a message..." className="flex-1 text-sm" />
                <Button type="submit" size="icon" disabled={!messageText.trim() || sendMsg.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
