/**
 * Monthly Bookkeeper Report Cron
 *
 * Runs at 9 AM UTC on the 1st of every month. For the previous calendar
 * month it:
 *   1. Builds the 8-sheet Squarespace Order Classifications workbook
 *      (same logic as /api/finance/report/export, via lib/data/monthly-report-workbook).
 *   2. Drafts an email to Sara Curran (bookkeeper) with the .xlsx attached.
 *      Drafts only — Joseph reviews and sends per SOP-FIN-001 step 4.
 *   3. Posts a confirmation to #ops in Slack.
 */

import { NextResponse } from "next/server";
import { buildMonthlyReportWorkbook } from "@/lib/data/monthly-report-workbook";
import { createGmailDraft, MAILBOXES } from "@/lib/gmail";
import { postToSlack } from "@/lib/slack";
import { getMonthName } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOOKKEEPER_EMAIL = "sara.curran@outlook.com";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow ?month=&year= overrides for manual reruns; default to previous month.
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const defaultYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const month = Number(searchParams.get("month")) || defaultMonth;
  const year = Number(searchParams.get("year")) || defaultYear;

  const monthLabel = `${getMonthName(month)} ${year}`;
  const monthNameOnly = getMonthName(month);

  try {
    const { buffer, filename, report } = await buildMonthlyReportWorkbook(month, year);

    const sender = MAILBOXES.joseph;
    const subject = `Steel Hearts — ${monthLabel} Squarespace Order Classifications`;
    const body = [
      `Hi Sara,`,
      ``,
      `Attached is the ${monthNameOnly} Squarespace order report. Let me know if you need anything else.`,
      ``,
      `Joe`,
    ].join("\n");

    const draft = await createGmailDraft({
      senderEmail: sender.email,
      senderName: sender.name,
      to: BOOKKEEPER_EMAIL,
      subject,
      body,
      attachments: [
        {
          filename,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          content: buffer,
        },
      ],
    });

    const slackLines = [
      `📒 *Monthly Bookkeeper Report — ${monthLabel}*`,
      `Gmail draft created for ${BOOKKEEPER_EMAIL} (review and send).`,
      `Attachment: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`,
      `Bracelets sold: ${report.summary.keyMetrics.braceletsSold} · Donations: $${report.summary.moneyIn.donationsReceived.toFixed(2)} · Disbursements: $${report.summary.moneyOut.disbursements.toFixed(2)}`,
      `Draft: https://mail.google.com/mail/u/0/#drafts`,
    ];
    await postToSlack("ops", slackLines.join("\n")).catch(() => {});

    return NextResponse.json({
      success: true,
      month,
      year,
      filename,
      bytes: buffer.length,
      draftId: draft.draftId,
      to: BOOKKEEPER_EMAIL,
      summary: {
        braceletsSold: report.summary.keyMetrics.braceletsSold,
        donationsReceived: report.summary.moneyIn.donationsReceived,
        disbursements: report.summary.moneyOut.disbursements,
        net: report.summary.net,
      },
    });
  } catch (err) {
    console.error("[monthly-bookkeeper-report] failed:", err);
    await postToSlack(
      "ops",
      `❌ Monthly bookkeeper report failed for ${monthLabel}: ${err.message}`
    ).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
