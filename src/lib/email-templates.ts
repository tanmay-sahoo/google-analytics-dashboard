// HTML email templates. Inline styles only — most mail clients (Gmail, Outlook,
// Apple Mail) strip <style> blocks or sandbox them. Keep markup table-based
// where layout matters; many clients still don't honor flex/grid in 2026.

export type AlertEmailInput = {
  projectName: string;
  metric: string;
  condition: "GT" | "LT" | "PCT_CHANGE";
  threshold: number;
  aggregation: string;
  windowLabel: string;
  message: string;
  value: number;
  comparedAgainst: number | null;
  evaluatedAt: Date;
  alertsUrl: string;
};

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toFixed(2);
}

function conditionLabel(condition: AlertEmailInput["condition"], threshold: number): string {
  if (condition === "GT") return `greater than ${formatNumber(threshold)}`;
  if (condition === "LT") return `less than ${formatNumber(threshold)}`;
  return `changed by more than ${formatNumber(threshold)}%`;
}

export function renderAlertEmail(input: AlertEmailInput): { subject: string; html: string; text: string } {
  const subject = `[Alert] ${input.projectName}: ${input.metric}`;

  const rows: Array<[string, string]> = [
    ["Project", input.projectName],
    ["Metric", input.metric],
    ["Condition", conditionLabel(input.condition, input.threshold)],
    ["Aggregation", `${input.aggregation} over ${input.windowLabel}`],
    ["Current value", formatNumber(input.value)]
  ];
  if (input.condition === "PCT_CHANGE" && input.comparedAgainst !== null) {
    rows.push(["Compared against", formatNumber(input.comparedAgainst)]);
  }
  rows.push(["Evaluated at", input.evaluatedAt.toUTCString()]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #eef0f3;font-size:13px;color:#6b7280;width:160px;vertical-align:top;">${escape(label)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #eef0f3;font-size:14px;color:#111827;font-weight:500;">${escape(value)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f2ec;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px 28px;color:#ffffff;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">Alert triggered</div>
              <div style="font-size:22px;font-weight:600;margin-top:6px;">${escape(input.projectName)}</div>
              <div style="font-size:14px;margin-top:4px;opacity:0.9;">${escape(input.metric)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px 28px;color:#111827;font-size:15px;line-height:1.55;">
              ${escape(input.message)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 12px 24px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef0f3;border-radius:12px;overflow:hidden;">
                ${rowsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <a href="${escape(input.alertsUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:11px 20px;border-radius:10px;">View in dashboard</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px 28px;border-top:1px solid #eef0f3;font-size:12px;color:#9ca3af;line-height:1.5;">
              You're receiving this email because alert notifications are enabled for your account. You can manage notification preferences in the admin user settings.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Alert triggered for ${input.projectName}

${input.message}

Project: ${input.projectName}
Metric: ${input.metric}
Condition: ${conditionLabel(input.condition, input.threshold)}
Aggregation: ${input.aggregation} over ${input.windowLabel}
Current value: ${formatNumber(input.value)}${
    input.condition === "PCT_CHANGE" && input.comparedAgainst !== null
      ? `\nCompared against: ${formatNumber(input.comparedAgainst)}`
      : ""
  }
Evaluated at: ${input.evaluatedAt.toUTCString()}

View in dashboard: ${input.alertsUrl}`;

  return { subject, html, text };
}
