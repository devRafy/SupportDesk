import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  useGetWorkspace, useUpdateWorkspace, useListAgents, useInviteAgent,
  useListFaqs, useCreateFaq, useUpdateFaq, useDeleteFaq,
  useListCanned, useCreateCanned, useUpdateCanned, useDeleteCanned,
  useCreateCheckout, useCreatePortal,
  getGetWorkspaceQueryKey, getListAgentsQueryKey, getListFaqsQueryKey, getListCannedQueryKey,
} from "@workspace/api-client-react";
import type { Faq, CannedResponse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Pencil, ExternalLink, Copy, Check, Star, Zap } from "lucide-react";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return { copied, copy };
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  const { data: workspace, isLoading: wsLoading } = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey() } });
  const { data: agents, isLoading: agentsLoading } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });
  const { data: faqs, isLoading: faqsLoading } = useListFaqs({ query: { queryKey: getListFaqsQueryKey() } });
  const { data: canned, isLoading: cannedLoading } = useListCanned({ query: { queryKey: getListCannedQueryKey() } });

  const updateWs = useUpdateWorkspace();
  const inviteAgent = useInviteAgent();
  const createFaq = useCreateFaq();
  const updateFaq = useUpdateFaq();
  const deleteFaq = useDeleteFaq();
  const createCanned = useCreateCanned();
  const updateCanned = useUpdateCanned();
  const deleteCanned = useDeleteCanned();
  const createCheckout = useCreateCheckout();
  const createPortal = useCreatePortal();

  const [wsName, setWsName] = useState("");
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", password: "demo1234" });
  const [faqModal, setFaqModal] = useState<{ open: boolean; item?: Faq }>({ open: false });
  const [faqForm, setFaqForm] = useState({ question: "", answer: "" });
  const [cannedModal, setCannedModal] = useState<{ open: boolean; item?: CannedResponse }>({ open: false });
  const [cannedForm, setCannedForm] = useState({ title: "", content: "" });
  const { copied, copy } = useCopy();

  useEffect(() => { if (workspace) setWsName(workspace.name); }, [workspace]);

  const widgetSnippet = workspace
    ? `<script src="${window.location.origin}/widget.js" data-workspace="${workspace.id}" async></script>`
    : "";

  const saveWorkspace = () => {
    updateWs.mutate({ data: { name: wsName } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
        toast({ title: "Workspace updated" });
      },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteAgent.mutate({ data: inviteForm }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        toast({ title: "Agent invited", description: `${inviteForm.email} can now log in.` });
        setInviteForm({ email: "", name: "", password: "demo1234" });
      },
      onError: () => toast({ title: "Invite failed", variant: "destructive" }),
    });
  };

  const saveFaq = () => {
    const action = faqModal.item
      ? updateFaq.mutateAsync({ id: faqModal.item.id, data: faqForm })
      : createFaq.mutateAsync({ data: { question: faqForm.question, answer: faqForm.answer, keywords: [] } });
    action.then(() => {
      qc.invalidateQueries({ queryKey: getListFaqsQueryKey() });
      toast({ title: faqModal.item ? "FAQ updated" : "FAQ created" });
      setFaqModal({ open: false });
    }).catch(() => toast({ title: "Failed to save FAQ", variant: "destructive" }));
  };

  const saveCanned = () => {
    const action = cannedModal.item
      ? updateCanned.mutateAsync({ id: cannedModal.item.id, data: cannedForm })
      : createCanned.mutateAsync({ data: cannedForm });
    action.then(() => {
      qc.invalidateQueries({ queryKey: getListCannedQueryKey() });
      toast({ title: cannedModal.item ? "Response updated" : "Response created" });
      setCannedModal({ open: false });
    }).catch(() => toast({ title: "Failed to save", variant: "destructive" }));
  };

  const handleUpgrade = () => {
    createCheckout.mutate(
      { data: { successUrl: window.location.href + "?upgraded=1", cancelUrl: window.location.href } },
      { onSuccess: (d) => { if (d.url) window.location.href = d.url; } }
    );
  };

  const handlePortal = () => {
    createPortal.mutate(undefined, {
      onSuccess: (d) => { if (d.url) window.location.href = d.url; }
    });
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Configure your workspace</p>
          </div>

          <Tabs defaultValue="workspace">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="widget">Widget</TabsTrigger>
              <TabsTrigger value="faqs">FAQs</TabsTrigger>
              <TabsTrigger value="canned">Canned Responses</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            {/* Workspace */}
            <TabsContent value="workspace" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workspace settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {wsLoading ? <Skeleton className="h-20 w-full" /> : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Workspace name</Label>
                        <Input value={wsName} onChange={(e) => setWsName(e.target.value)} />
                      </div>
                      <Button onClick={saveWorkspace} disabled={updateWs.isPending} size="sm">
                        {updateWs.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Agents */}
            <TabsContent value="agents" className="mt-4 space-y-4">
              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Invite agent</CardTitle>
                    <CardDescription>The default password is "demo1234" — agent can change it after login.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleInvite} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Name</Label>
                          <Input placeholder="Jane Smith" value={inviteForm.name} onChange={(e) => setInviteForm(f => ({ ...f, name: e.target.value }))} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input type="email" placeholder="agent@company.com" value={inviteForm.email} onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))} required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Initial password</Label>
                        <Input type="password" value={inviteForm.password} onChange={(e) => setInviteForm(f => ({ ...f, password: e.target.value }))} required />
                      </div>
                      <Button type="submit" size="sm" disabled={inviteAgent.isPending}>
                        {inviteAgent.isPending ? "Inviting..." : "Invite agent"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle className="text-base">Team members</CardTitle></CardHeader>
                <CardContent>
                  {agentsLoading ? <Skeleton className="h-32 w-full" /> : (
                    <div className="divide-y divide-border">
                      {(agents ?? []).map((a) => (
                        <div key={a.id} className="flex items-center py-3 gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary">{a.name?.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{a.name}</p>
                            <p className="text-xs text-muted-foreground">{a.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {a.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                            <Badge variant={a.role === "admin" ? "default" : "secondary"} className="text-[11px]">{a.role}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Widget */}
            <TabsContent value="widget" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Embed widget</CardTitle>
                  <CardDescription>Paste this snippet before the closing &lt;/body&gt; tag on your website.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <pre className="bg-muted text-sm p-4 rounded-lg overflow-x-auto pr-12 font-mono text-xs">{widgetSnippet}</pre>
                    <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => copy(widgetSnippet)}>
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Or open the widget directly at{" "}
                    <a href={`/widget/${workspace?.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      /widget/{workspace?.id} <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FAQs */}
            <TabsContent value="faqs" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{(faqs ?? []).length} entries — the bot uses these to auto-reply</p>
                <Button size="sm" onClick={() => { setFaqForm({ question: "", answer: "" }); setFaqModal({ open: true }); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add FAQ
                </Button>
              </div>
              <div className="space-y-2">
                {faqsLoading ? <Skeleton className="h-48 w-full" /> : (faqs ?? []).map((faq) => (
                  <Card key={faq.id}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{faq.question}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{faq.answer}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setFaqForm({ question: faq.question, answer: faq.answer }); setFaqModal({ open: true, item: faq }); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteFaq.mutate({ id: faq.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListFaqsQueryKey() }) })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Canned Responses */}
            <TabsContent value="canned" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{(canned ?? []).length} responses — quick inserts for agents</p>
                <Button size="sm" onClick={() => { setCannedForm({ title: "", content: "" }); setCannedModal({ open: true }); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Response
                </Button>
              </div>
              <div className="space-y-2">
                {cannedLoading ? <Skeleton className="h-48 w-full" /> : (canned ?? []).map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.content}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setCannedForm({ title: c.title, content: c.content }); setCannedModal({ open: true, item: c }); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCanned.mutate({ id: c.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListCannedQueryKey() }) })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Billing */}
            <TabsContent value="billing" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className={workspace?.plan === "free" ? "border-primary/40 bg-primary/5" : ""}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-1.5"><Star className="w-4 h-4" /> Free</p>
                        <p className="text-2xl font-bold mt-1">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      </div>
                      {workspace?.plan === "free" && <Badge>Current plan</Badge>}
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {["1 agent", "100 conversations/mo", "10 FAQ entries", "Chat widget", "Basic analytics"].map(f => (
                        <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" />{f}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className={workspace?.plan === "pro" ? "border-primary bg-primary/5" : "border-primary/40"}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /> Pro</p>
                        <p className="text-2xl font-bold mt-1">$19<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      </div>
                      {workspace?.plan === "pro" && <Badge>Current plan</Badge>}
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {["Unlimited agents", "Unlimited conversations", "Unlimited FAQs", "Advanced analytics", "Canned responses", "Priority support"].map(f => (
                        <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" />{f}</li>
                      ))}
                    </ul>
                    {workspace?.plan === "free" ? (
                      <Button className="w-full" onClick={handleUpgrade} disabled={createCheckout.isPending}>
                        {createCheckout.isPending ? "Redirecting..." : "Upgrade to Pro"}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={handlePortal} disabled={createPortal.isPending}>
                        <ExternalLink className="w-4 h-4 mr-1.5" />
                        Manage billing
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* FAQ Modal */}
      <Dialog open={faqModal.open} onOpenChange={(open) => setFaqModal({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{faqModal.item ? "Edit FAQ" : "Add FAQ"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Input value={faqForm.question} onChange={(e) => setFaqForm(f => ({ ...f, question: e.target.value }))} placeholder="How do I reset my password?" />
            </div>
            <div className="space-y-1.5">
              <Label>Answer</Label>
              <Textarea value={faqForm.answer} onChange={(e) => setFaqForm(f => ({ ...f, answer: e.target.value }))} rows={4} placeholder="To reset your password..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqModal({ open: false })}>Cancel</Button>
            <Button onClick={saveFaq}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Canned Modal */}
      <Dialog open={cannedModal.open} onOpenChange={(open) => setCannedModal({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cannedModal.item ? "Edit response" : "Add canned response"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={cannedForm.title} onChange={(e) => setCannedForm(f => ({ ...f, title: e.target.value }))} placeholder="Greeting" />
            </div>
            <div className="space-y-1.5">
              <Label>Response body</Label>
              <Textarea value={cannedForm.content} onChange={(e) => setCannedForm(f => ({ ...f, content: e.target.value }))} rows={4} placeholder="Hi there! Thanks for reaching out..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCannedModal({ open: false })}>Cancel</Button>
            <Button onClick={saveCanned}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
