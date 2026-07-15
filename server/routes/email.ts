import { Router } from "express";
import { supabase } from "../supabase.js";
import { isMailerConfigured, sendMail } from "../mailer.js";
import { buildGoogleCalendarUrl, buildInterviewIcs, buildInviteEmailHtml } from "../emailTemplates.js";

const router = Router();

// POST /api/email/send-invite — Send mock interview invitation email
router.post("/send-invite", async (req, res) => {
  const { mockSessionId, recipientEmail, interviewDetails, sentBy } = req.body;

  if (!mockSessionId || !recipientEmail || !sentBy) {
    return res.status(400).json({ error: "mockSessionId, recipientEmail, and sentBy are required" });
  }

  if (!isMailerConfigured()) {
    return res.status(500).json({ error: "Email sending is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)" });
  }

  try {
    // Fetch session for invite token
    const { data: session } = await supabase
      .from("mock_sessions")
      .select("invite_token, job_title, scheduled_at")
      .eq("id", mockSessionId)
      .single();

    if (!session) {
      return res.status(404).json({ error: "Mock session not found" });
    }

    const appUrl = process.env.APP_URL || "http://localhost:8080";
    const redirectPath = `/spaces?session=${session.invite_token}`;
    const inviteUrl = `${appUrl}/auth?redirect=${encodeURIComponent(redirectPath)}`;
    const jobTitle = interviewDetails?.jobTitle || session.job_title || "Mock Interview";
    const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
    const scheduledAtLabel = scheduledDate
      ? scheduledDate.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })
      : null;

    const html = buildInviteEmailHtml({
      heading: "Mock Interview Invitation",
      greeting: "You've been invited to a mock interview session to help you prepare for your upcoming interviews.",
      roleTitle: jobTitle,
      scheduledAtLabel,
      ctaUrl: inviteUrl,
      ctaLabel: "Go to Your Interview",
      googleCalendarUrl: scheduledDate
        ? buildGoogleCalendarUrl({
            title: `Mock Interview — ${jobTitle}`,
            description: `Your mock interview for ${jobTitle}. Join here: ${inviteUrl}`,
            location: inviteUrl,
            startsAt: scheduledDate,
          })
        : null,
      footerNote:
        "You'll need to log in or create an account to access your interview. The interview consists of 10 AI-powered questions tailored to the role.",
    });

    const attachments = scheduledDate
      ? [
          {
            filename: "mock-interview.ics",
            content: buildInterviewIcs({
              uid: `mock-session-${mockSessionId}@screen.ai`,
              title: `Mock Interview — ${jobTitle}`,
              description: `Your mock interview for ${jobTitle}. Join here: ${inviteUrl}`,
              location: inviteUrl,
              startsAt: scheduledDate,
            }),
            contentType: "text/calendar",
          },
        ]
      : undefined;

    let messageId: string;
    try {
      messageId = await sendMail({
        to: recipientEmail,
        subject: `You have a mock interview scheduled — ${jobTitle}`,
        html,
        attachments,
      });
    } catch (emailError: any) {
      console.error("[Email] Send error:", emailError);
      return res.status(500).json({ error: emailError.message || "Failed to send email" });
    }

    // Record invitation
    await supabase.from("email_invitations").insert({
      mock_session_id: mockSessionId,
      recipient_email: recipientEmail,
      sent_by: sentBy,
      resend_message_id: messageId || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    // Mark session as email sent
    await supabase
      .from("mock_sessions")
      .update({ invite_email_sent: true })
      .eq("id", mockSessionId);

    res.json({ success: true, messageId });
  } catch (error) {
    console.error("[Email] Send error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// POST /api/email/send-candidate-invite — Send candidate interview invitation email
router.post("/send-candidate-invite", async (req, res) => {
  const { interviewId } = req.body;

  if (!interviewId) {
    return res.status(400).json({ error: "interviewId is required" });
  }

  if (!isMailerConfigured()) {
    return res.status(500).json({ error: "Email sending is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)" });
  }

  try {
    const { data: interview } = await supabase
      .from("interviews")
      .select("invite_token, scheduled_at, candidates(full_name, email), question_packs(title)")
      .eq("id", interviewId)
      .single();

    if (!interview || !interview.invite_token) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const candidate = interview.candidates as unknown as { full_name: string; email: string } | null;
    if (!candidate?.email) {
      return res.status(400).json({ error: "Candidate has no email on file" });
    }

    const appUrl = process.env.APP_URL || "http://localhost:8080";
    const inviteUrl = `${appUrl}/candidate/${interview.invite_token}`;
    const roleTitle = (interview.question_packs as unknown as { title: string } | null)?.title || "your interview";
    const scheduledDate = interview.scheduled_at ? new Date(interview.scheduled_at) : null;
    const scheduledAtLabel = scheduledDate
      ? scheduledDate.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })
      : null;
    const firstName = candidate.full_name?.split(" ")[0] || "there";

    const html = buildInviteEmailHtml({
      heading: "You're Invited to Interview",
      greeting: `Hi ${firstName}, we're excited to move forward with your application. You've been invited to complete an AI-conducted interview for the role below.`,
      roleTitle,
      scheduledAtLabel,
      ctaUrl: inviteUrl,
      ctaLabel: "View Interview & Get Started",
      googleCalendarUrl: scheduledDate
        ? buildGoogleCalendarUrl({
            title: `Interview — ${roleTitle}`,
            description: `Your interview for ${roleTitle}. Join here: ${inviteUrl}`,
            location: inviteUrl,
            startsAt: scheduledDate,
          })
        : null,
      footerNote:
        "No account or download is needed — just open the link above when you're ready to begin. The interview is conducted by our AI assistant and typically takes 20–30 minutes.",
    });

    const attachments = scheduledDate
      ? [
          {
            filename: "interview.ics",
            content: buildInterviewIcs({
              uid: `interview-${interviewId}@screen.ai`,
              title: `Interview — ${roleTitle}`,
              description: `Your interview for ${roleTitle}. Join here: ${inviteUrl}`,
              location: inviteUrl,
              startsAt: scheduledDate,
            }),
            contentType: "text/calendar",
          },
        ]
      : undefined;

    let messageId: string;
    try {
      messageId = await sendMail({
        to: candidate.email,
        subject: `You're invited to interview — ${roleTitle}`,
        html,
        attachments,
      });
    } catch (emailError: any) {
      console.error("[Email] Send error:", emailError);
      return res.status(500).json({ error: emailError.message || "Failed to send email" });
    }

    res.json({ success: true, messageId });
  } catch (error) {
    console.error("[Email] Send error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
