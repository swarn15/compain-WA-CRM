"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  Check,
  ChevronDown,
  Plus,
  Smartphone,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WorkspaceItem {
  id: string;
  name: string;
  isOwner: boolean;
  createdAt: string;
  whatsapp: {
    phoneNumberId: string;
    status: string;
  } | null;
}

export function WorkspaceSwitcher() {
  const { accountId, refreshProfile } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  // New Workspace Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (err) {
      console.error("[WorkspaceSwitcher] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [accountId]);

  const activeWorkspace = workspaces.find((w) => w.id === accountId) || {
    id: accountId || "",
    name: "Workspace",
    isOwner: true,
    createdAt: "",
    whatsapp: null,
  };

  const handleSwitch = async (targetId: string) => {
    if (targetId === accountId || switching) return;
    setSwitching(targetId);
    try {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: targetId }),
      });
      if (res.ok) {
        await refreshProfile();
        // Full refresh ensures all cached queries, subscriptions & state reset cleanly
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to switch workspace");
        setSwitching(null);
      }
    } catch (err) {
      console.error("Switch error:", err);
      setSwitching(null);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || creating) return;

    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setDialogOpen(false);
        setNewWorkspaceName("");
        await refreshProfile();
        // Navigate to settings tab=whatsapp so user can easily connect the new number
        window.location.href = "/settings?tab=whatsapp";
      } else {
        const err = await res.json();
        setCreateError(err.error || "Failed to create workspace");
      }
    } catch (err) {
      setCreateError("Network error occurred");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="px-3 pt-3 pb-1">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-accent/50 focus:outline-none">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Smartphone className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {activeWorkspace.name}
                  </p>
                  {activeWorkspace.whatsapp?.status === "connected" ? (
                    <span
                      className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"
                      title="WhatsApp Connected"
                    />
                  ) : (
                    <span
                      className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
                      title="WhatsApp Disconnected"
                    />
                  )}
                </div>
                <p className="truncate text-[10px] text-muted-foreground">
                  {activeWorkspace.whatsapp?.status === "connected"
                    ? "Active WhatsApp"
                    : "No WhatsApp connected"}
                </p>
              </div>
            </div>
            {switching ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            className="w-56 bg-popover text-popover-foreground shadow-md ring-border"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
                WhatsApp Workspaces / Numbers
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {workspaces.map((ws) => {
                const isSelected = ws.id === accountId;
                const isConnected = ws.whatsapp?.status === "connected";

                return (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => handleSwitch(ws.id)}
                    disabled={!!switching}
                    className="flex items-center justify-between gap-2 py-2 cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          isConnected
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {ws.name}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {isConnected ? "Connected" : "Disconnected"}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 text-primary cursor-pointer font-medium text-xs py-2"
            >
              <Plus className="size-3.5" />
              <span>+ Add WhatsApp Number</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog to create a new workspace / WhatsApp number */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateWorkspace}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Add New WhatsApp Number
              </DialogTitle>
              <DialogDescription>
                Create a dedicated workspace for a new WhatsApp number. It will have its
                own chats, automations, and AI chatbot.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Number or Department Name</Label>
                <Input
                  id="ws-name"
                  placeholder="e.g. Sales Team (+91 98...) or Support Bot"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {createError && (
                <p className="text-xs text-destructive">{createError}</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newWorkspaceName.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create & Connect Number"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
