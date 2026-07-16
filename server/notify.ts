import { supabase } from "./supabase.js";

// Create a notification for a single recipient (by email). Never throws — a
// notification failure must not break the action that triggered it.
export async function createNotification(opts: {
  orgId: string | null;
  recipientEmail: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    const { error } = await supabase.rpc("create_notification", {
      p_org_id: opts.orgId,
      p_recipient_email: opts.recipientEmail,
      p_type: opts.type,
      p_title: opts.title,
      p_body: opts.body ?? null,
      p_link: opts.link ?? null,
    });
    if (error) console.error("[notify] create failed:", error.message);
  } catch (err) {
    console.error("[notify] create error:", err);
  }
}

// Notify all non-admin users in an org (e.g. a new job published).
export async function notifyOrgUsers(opts: {
  orgId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    const { error } = await supabase.rpc("notify_org_users", {
      p_org_id: opts.orgId,
      p_type: opts.type,
      p_title: opts.title,
      p_body: opts.body ?? null,
      p_link: opts.link ?? null,
    });
    if (error) console.error("[notify] org broadcast failed:", error.message);
  } catch (err) {
    console.error("[notify] org broadcast error:", err);
  }
}