import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const { error } = await supabase.rpc("switch_workspace", {
      p_account_id: accountId,
    });

    if (error) {
      console.error("[POST /api/workspaces/switch] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      activeWorkspaceId: accountId,
    });
  } catch (err) {
    console.error("[POST /api/workspaces/switch] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
