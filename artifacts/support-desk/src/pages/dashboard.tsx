import { useState, useEffect, useRef } from "react";
import Layout from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import {
  useListConversations, useGetConversation, useListMessages, useListAgents,
  useSendMessage, useMarkMessagesRead, useUpdateConversationStatus, useAssignConversation,
  useListCanned,
  getListConversationsQueryKey, getListMessagesQueryKey, getGetConversationQueryKey,
  getListCannedQueryKey, getListAgentsQueryKey,
} from "@workspace/api-client-react";
import type { Conversation, Message, CannedResponse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Search, Send, CheckCircle, Circle, User, Zap, RefreshCw } from "lucide-react";

type StatusFilter = "all" | "open" | "in_progress" | "resolved";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500",
  in_progress: "bg-yellow-500",
  resolved: "bg-slate-400",
};

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    open: "bg-green-100 text-green-700 border-green-200",
    in_progress: "bg-yellow-100 text-yellow-700 border-yellow-200",
    resolved: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full border font-medium", colors[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}
    </span>
  );
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ConversationItem({ conv, selected, onClick }: { conv: Conversation; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 border-b border-border transition-colors flex flex-col gap-1",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[conv.status] ?? "bg-muted")} />
          <span className="font-medium text-sm truncate">{conv.visitorName}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {conv.unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {conv.unreadCount}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{timeAgo(conv.updatedAt ?? conv.createdAt)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate pl-4">
        {conv.lastMessage ?? conv.visitorEmail}
      </p>
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const socket = useSocket();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showCanned, setShowCanned] = useState(false);
  const [cannedSearch, setCannedSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading, refetch: refetchConvs } = useListConversations(
    statusFilter === "all" ? {} : { status: statusFilter },
    { query: { queryKey: getListConversationsQueryKey(statusFilter === "all" ? {} : { status: statusFilter }), refetchInterval: 15000 } }
  );

  const { data: selectedConv } = useGetConversation(selectedId!, {
    query: { queryKey: getGetConversationQueryKey(selectedId!), enabled: !!selectedId }
  });

  const { data: messages, isLoading: msgsLoading } = useListMessages(selectedId!, {
    query: { queryKey: getListMessagesQueryKey(selectedId!), enabled: !!selectedId, refetchInterval: 5000 }
  });

  const { data: agents } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });
  const { data: canned } = useListCanned({ query: { queryKey: getListCannedQueryKey() } });

  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesRead();
  const updateStatus = useUpdateConversationStatus();
  const assignConv = useAssignConversation();

  // Socket.io events
  useEffect(() => {
    if (!socket) return;
    const handleNewMsg = (data: { conversationId: number }) => {
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      if (data.conversationId === selectedId) {
        qc.invalidateQueries({ queryKey: getListMessagesQueryKey(data.conversationId) });
      }
    };
    const handleConvUpdated = () => {
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    };
    socket.on("new_message", handleNewMsg);
    socket.on("conversation_updated", handleConvUpdated);
    return () => {
      socket.off("new_message", handleNewMsg);
      socket.off("conversation_updated", handleConvUpdated);
    };
  }, [socket, selectedId, qc]);

  // Join conversation room + mark read
  useEffect(() => {
    if (!selectedId || !socket) return;
    socket.emit("join_conversation", { conversationId: selectedId });
    markRead.mutate({ id: selectedId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListConversationsQueryKey() })
    });
  }, [selectedId, socket]); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConvs = (conversations ?? []).filter(c =>
    !search ||
    c.visitorName.toLowerCase().includes(search.toLowerCase()) ||
    c.visitorEmail.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCanned = (canned ?? []).filter(c =>
    !cannedSearch || c.title.toLowerCase().includes(cannedSearch.toLowerCase())
  );

  const handleSend = () => {
    if (!messageText.trim() || !selectedId) return;
    const text = messageText;
    setMessageText("");
    setShowCanned(false);
    sendMsg.mutate(
      { id: selectedId, data: { content: text, senderType: "agent", sender: user?.name ?? "Agent" } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey(selectedId) });
          qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
        onError: () => toast({ title: "Failed to send", variant: "destructive" }),
      }
    );
  };

  const handleTyping = () => {
    if (!socket || !selectedId) return;
    socket.emit("agent_typing", { conversationId: selectedId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStatus = (status: string) => {
    if (!selectedId) return;
    updateStatus.mutate(
      { id: selectedId, data: { status } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          if (selectedId) qc.invalidateQueries({ queryKey: getGetConversationQueryKey(selectedId) });
          toast({ title: `Marked as ${status}` });
        },
      }
    );
  };

  const handleAssign = (agentId: string) => {
    if (!selectedId) return;
    assignConv.mutate(
      { id: selectedId, data: { agentId: Number(agentId) } },
      {
        onSuccess: () => {
          if (selectedId) qc.invalidateQueries({ queryKey: getGetConversationQueryKey(selectedId) });
          toast({ title: "Conversation assigned" });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-border bg-background">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 h-8 text-xs" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => refetchConvs()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex gap-1">
              {([
                { value: "open", label: "Open" },
                { value: "in_progress", label: "Active" },
                { value: "resolved", label: "Done" },
                { value: "all", label: "All" },
              ] as { value: StatusFilter; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    "flex-1 text-[11px] font-medium py-1 rounded transition-colors",
                    statusFilter === value ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {convsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No {statusFilter} conversations</p>
              </div>
            ) : (
              filteredConvs.map((conv) => (
                <ConversationItem key={conv.id} conv={conv} selected={conv.id === selectedId} onClick={() => setSelectedId(conv.id)} />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat panel */}
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-muted/20 p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-1">Select a conversation</h2>
            <p className="text-muted-foreground text-sm max-w-xs">Choose a conversation from the list to start chatting with your customers.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-background flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">{selectedConv?.visitorName}</h2>
                  {selectedConv && statusBadge(selectedConv.status)}
                </div>
                <p className="text-xs text-muted-foreground">{selectedConv?.visitorEmail}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select onValueChange={handleAssign} value={selectedConv?.assignedAgentId?.toString() ?? ""}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <User className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {(agents ?? []).map(a => (
                      <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedConv?.status !== "resolved" ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleStatus("resolved")} disabled={updateStatus.isPending}>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Resolve
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleStatus("open")} disabled={updateStatus.isPending}>
                    <Circle className="w-3.5 h-3.5" /> Reopen
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {msgsLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className={cn("h-12 w-64", i % 2 === 0 ? "" : "ml-auto")} />)}
                </div>
              ) : (
                <div className="space-y-3 px-2">
                  {(messages ?? []).map((msg: Message) => {
                    const isAgent = msg.senderType === "agent";
                    const isBot = msg.senderType === "bot";
                    const isVisitor = msg.senderType === "visitor";

                    return (
                      <div key={msg.id} className={cn("flex gap-2.5", isVisitor ? "flex-row" : "flex-row-reverse")}>
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-1",
                          isBot ? "bg-violet-500" : isAgent ? "bg-primary" : "bg-slate-400"
                        )}>
                          {isBot ? "🤖" : isVisitor ? (msg.sender?.slice(0, 1)?.toUpperCase() ?? "V") : (msg.sender?.slice(0, 1)?.toUpperCase() ?? "A")}
                        </div>
                        <div className={cn("max-w-[70%] flex flex-col gap-0.5", isVisitor ? "items-start" : "items-end")}>
                          <span className="text-[11px] text-muted-foreground font-medium px-1">
                            {isBot ? "Bot" : (msg.sender ?? (isVisitor ? "Visitor" : "Agent"))}
                          </span>
                          <div className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm",
                            isVisitor ? "bg-muted text-foreground rounded-tl-sm"
                              : isBot ? "bg-violet-100 text-violet-900 rounded-tr-sm"
                              : "bg-primary text-white rounded-tr-sm"
                          )}>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground px-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Canned responses */}
            {showCanned && (
              <div className="border-t border-border bg-background px-4 py-2 max-h-48 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <Input value={cannedSearch} onChange={(e) => setCannedSearch(e.target.value)} placeholder="Search canned responses..." className="h-7 text-xs flex-1" autoFocus />
                  <button onClick={() => setShowCanned(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
                <div className="space-y-1">
                  {filteredCanned.map((c: CannedResponse) => (
                    <button key={c.id} onClick={() => { setMessageText(c.content); setShowCanned(false); }} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors">
                      <p className="text-xs font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.content}</p>
                    </button>
                  ))}
                  {filteredCanned.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No responses found</p>}
                </div>
              </div>
            )}

            {/* Input */}
            {selectedConv?.status !== "resolved" ? (
              <div className="border-t border-border p-3 bg-background flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setShowCanned(v => !v)}>
                        <Zap className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Canned responses</TooltipContent>
                  </Tooltip>
                  <Textarea
                    value={messageText}
                    onChange={(e) => { setMessageText(e.target.value); handleTyping(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Reply to customer… (Enter to send, Shift+Enter for newline)"
                    className="flex-1 min-h-[40px] max-h-32 resize-none text-sm py-2"
                    rows={1}
                  />
                  <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSend} disabled={!messageText.trim() || sendMsg.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border p-4 bg-muted/30 text-center flex-shrink-0">
                <p className="text-sm text-muted-foreground">This conversation is resolved.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => handleStatus("open")}>Reopen conversation</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
