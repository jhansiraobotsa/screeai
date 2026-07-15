function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsEscape(text: string) {
  return text.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, "\\n");
}

export function buildInterviewIcs(opts: {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  durationMinutes?: number;
}) {
  const start = opts.startsAt;
  const end = new Date(start.getTime() + (opts.durationMinutes ?? 60) * 60_000);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Screen.ai//Interview Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${icsDate(new Date(0))}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function buildGoogleCalendarUrl(opts: {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  durationMinutes?: number;
}) {
  const start = opts.startsAt;
  const end = new Date(start.getTime() + (opts.durationMinutes ?? 60) * 60_000);
  const fmt = (d: Date) => icsDate(d);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: opts.description,
    location: opts.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildInviteEmailHtml(opts: {
  heading: string;
  greeting: string;
  roleTitle: string;
  scheduledAtLabel: string | null;
  ctaUrl: string;
  ctaLabel: string;
  googleCalendarUrl: string | null;
  footerNote: string;
}) {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 26px; color: #1a1a2e; margin: 0; letter-spacing: -0.5px;">Screen.ai</h1>
    <p style="color: #6b7280; font-size: 13px; margin-top: 4px; letter-spacing: 0.3px; text-transform: uppercase;">AI-Powered Interviews</p>
  </div>

  <div style="background: #f8f9fb; border-radius: 14px; padding: 36px 32px; margin-bottom: 24px; border: 1px solid #eef0f4;">
    <h2 style="font-size: 21px; color: #1a1a2e; margin: 0 0 14px; font-weight: 700;">${opts.heading}</h2>
    <p style="color: #4b5563; font-size: 15.5px; line-height: 1.6; margin: 0 0 20px;">
      ${opts.greeting}
    </p>

    <div style="background: white; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; border: 1px solid #eef0f4;">
      <p style="margin: 0 0 6px; color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Role</p>
      <p style="margin: 0; color: #1a1a2e; font-size: 16px; font-weight: 600;">${opts.roleTitle}</p>
      ${opts.scheduledAtLabel ? `
        <p style="margin: 16px 0 6px; color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;">Scheduled For</p>
        <p style="margin: 0; color: #1a1a2e; font-size: 16px; font-weight: 600;">${opts.scheduledAtLabel}</p>
      ` : ""}
    </div>

    <div style="text-align: center; margin-bottom: ${opts.googleCalendarUrl ? "14px" : "0"};">
      <a href="${opts.ctaUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #6d28d9, #7c3aed); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(109, 40, 217, 0.35);">
        ${opts.ctaLabel} &rarr;
      </a>
    </div>

    ${opts.googleCalendarUrl ? `
    <div style="text-align: center;">
      <a href="${opts.googleCalendarUrl}" style="display: inline-block; padding: 10px 20px; color: #6d28d9; text-decoration: none; font-weight: 600; font-size: 13.5px; border: 1px solid #d8c8f7; border-radius: 8px;">
        📅 Add to Google Calendar
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0;">
        A calendar invite (.ics) is also attached to this email for Outlook / Apple Calendar.
      </p>
    </div>
    ` : ""}
  </div>

  <p style="color: #9ca3af; font-size: 12.5px; text-align: center; line-height: 1.6; margin: 0;">
    ${opts.footerNote}
  </p>

  <p style="color: #c1c5cd; font-size: 11.5px; text-align: center; margin: 24px 0 0;">
    This is an automated message from Screen.ai. If you weren't expecting this invitation, you can safely ignore this email.
  </p>
</div>
  `.trim();
}
