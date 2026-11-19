import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current active profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Query accounts owned or member of
    const admin = getAdminClient();
    
    // Get all account IDs user has access to
    const { data: memberships } = await admin
      .from("user_account_memberships")
      .select("account_id, role")
      .eq("user_id", user.id);

    const memberAccountIds = (memberships || []).map((m: { account_id: string }) => m.account_id);

    const { data: accounts, error: acctsErr } = await admin
      .from("accounts")
      .select("id, name, created_at, owner_user_id")
      .or(
        `owner_user_id.eq.${user.id}${
          memberAccountIds.length > 0 ? `,id.in.(${memberAccountIds.join(",")})` : ""
        }`
      )
      .order("created_at", { ascending: true });

    if (acctsErr) {
      console.error("[GET /api/workspaces] error fetching accounts:", acctsErr);
      return NextResponse.json({ error: acctsErr.message }, { status: 500 });
    }

    // Get WhatsApp status for all these accounts
    const accountIds = (accounts || []).map((a: { id: string }) => a.id);
    const { data: configs } = await admin
      .from("whatsapp_config")
      .select("account_id, phone_number_id, status")
      .in("account_id", accountIds.length > 0 ? accountIds : ["00000000-0000-0000-0000-000000000000"]);

    const configMap = new Map<string, { phone_number_id: string; status: string }>();
    for (const c of configs || []) {
      configMap.set(c.account_id, {
        phone_number_id: c.phone_number_id,
        status: c.status,
      });
    }

    const workspaces = (accounts || []).map((a: { id: string; name: string; created_at: string; owner_user_id: string }) => {
      const cfg = configMap.get(a.id);
      return {
        id: a.id,
        name: a.name,
        isOwner: a.owner_user_id === user.id,
        createdAt: a.created_at,
        whatsapp: cfg
          ? {
              phoneNumberId: cfg.phone_number_id,
              status: cfg.status,
            }
          : null,
      };
    });

    return NextResponse.json({
      workspaces,
      activeWorkspaceId: profile?.account_id ?? null,
    });
  } catch (err) {
    console.error("[GET /api/workspaces] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const { data: newAccountId, error } = await supabase.rpc("create_workspace", {
      p_name: name,
    });

    if (error) {
      console.error("[POST /api/workspaces] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      accountId: newAccountId,
    });
  } catch (err) {
    console.error("[POST /api/workspaces] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
