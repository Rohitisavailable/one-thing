import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:8000",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const backboardKey = Deno.env.get("BACKBOARD_API_KEY");
  if (!token || !url || !anonKey) return reply({ error: "A private browser session is required to delete a plan." }, 401);
  if (!serviceKey || !backboardKey) return reply({ error: "The site operator has not finished configuring deletion." }, 503);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return reply({ error: "Your private browser session expired. Reload the page and try again." }, 401);
  let body: { plan_id?: string };
  try { body = await req.json(); } catch { return reply({ error: "Request body must be JSON." }, 400); }
  if (!body.plan_id) return reply({ error: "A plan id is required." }, 400);

  const { data: plan, error: findError } = await client.from("plans").select("id,backboard_thread_id").eq("id", body.plan_id).maybeSingle();
  if (findError || !plan) return reply({ error: "Plan not found or you do not own it." }, 404);
  if (plan.backboard_thread_id) {
    const remoteDelete = await fetch(`https://app.backboard.io/api/threads/${encodeURIComponent(plan.backboard_thread_id)}`, { method: "DELETE", headers: { "X-API-Key": backboardKey } });
    if (!remoteDelete.ok && remoteDelete.status !== 404) return reply({ error: "Backboard could not remove its copy. The saved plan was kept; try deleting again." }, 502);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: deleteError } = await admin.from("plans").delete().eq("id", plan.id);
  if (deleteError) return reply({ error: "Could not delete the saved plan: " + deleteError.message }, 500);
  return reply({ deleted: true });
});
