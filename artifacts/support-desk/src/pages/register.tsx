import { useState } from "react";
import { useRegister } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, User, Mail, Lock, Building2 } from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", workspaceName: "" });
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { data: form },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          setLocation("/dashboard");
        },
        onError: () => {
          toast({ title: "Registration failed", description: "Email may already be in use.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-sidebar flex">
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-sidebar p-12 border-r border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SupportDesk</span>
        </div>
        <div className="space-y-6">
          <div>
            <div className="text-4xl font-bold text-white mb-2">Set up in minutes.</div>
            <div className="text-4xl font-bold text-primary">Support forever.</div>
          </div>
          <div className="space-y-4">
            {[
              { step: "1", text: "Create your workspace" },
              { step: "2", text: "Paste the widget on your site" },
              { step: "3", text: "Start chatting with visitors" },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-4">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-bold">{s.step}</span>
                </div>
                <span className="text-sidebar-foreground text-sm">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sidebar-foreground text-xs">No credit card required for free plan</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">SupportDesk</span>
          </div>

          <h1 className="text-2xl font-bold mb-1">Create your workspace</h1>
          <p className="text-muted-foreground text-sm mb-8">Free forever. No credit card required.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="workspaceName" data-testid="input-workspace" placeholder="Acme Corp" value={form.workspaceName} onChange={set("workspaceName")} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" data-testid="input-name" placeholder="Jane Smith" value={form.name} onChange={set("name")} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" data-testid="input-email" type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" data-testid="input-password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")} className="pl-10" required />
              </div>
            </div>
            <Button type="submit" data-testid="button-register" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating workspace..." : "Create workspace"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-primary font-medium hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
