// Supabase Edge Function: send-push
// Drains push_outbox via claim_push_batch RPC, sends each via Web Push,
// then reports back via mark_push_result. Triggered by a cron schedule.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type ClaimedItem = {
  outbox_id: string;
  subscription_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string | null;
  body: string | null;
  url: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:owner@example.com";

Deno.serve(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "missing supabase env" }, 500);
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ ok: false, error: "missing VAPID env" }, 500);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase.rpc("claim_push_batch", { p_limit: 50 });
  if (error) {
    console.error("[send-push] claim_push_batch failed", error);
    return json({ ok: false, error: error.message }, 500);
  }

  const batch = (data ?? []) as ClaimedItem[];
  if (batch.length === 0) {
    return json({ ok: true, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const item of batch) {
    const payload = JSON.stringify({
      title: item.title ?? "MVS",
      body: item.body ?? "",
      url: item.url ?? "/",
      tag: `mvs-${item.outbox_id}`,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: { p256dh: item.p256dh, auth: item.auth },
        },
        payload,
      );

      const { error: markError } = await supabase.rpc("mark_push_result", {
        p_outbox_id: item.outbox_id,
        p_subscription_id: item.subscription_id,
        p_success: true,
      });
      if (markError) console.error("[send-push] mark success failed", markError);
      sent++;
    } catch (err) {
      const e = err as { statusCode?: number; message?: string };
      const statusCode = e?.statusCode;
      const shouldUnsubscribe = statusCode === 410 || statusCode === 404;
      const message = (e?.message ?? "unknown").slice(0, 200);

      const { error: markError } = await supabase.rpc("mark_push_result", {
        p_outbox_id: item.outbox_id,
        p_subscription_id: item.subscription_id,
        p_success: false,
        p_error: message,
        p_should_unsubscribe: shouldUnsubscribe,
      });
      if (markError) console.error("[send-push] mark failure failed", markError);
      failed++;
    }
  }

  return json({ ok: true, sent, failed });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
