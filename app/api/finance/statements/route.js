import { NextResponse } from "next/server";
import { getMessage, getAttachment } from "@/lib/gmail";
import { getServerClient } from "@/lib/supabase";
import { uploadFileToDrive, getStatementsFolderId } from "@/lib/gdrive";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Known financial institution patterns → account metadata
// ---------------------------------------------------------------------------
const INSTITUTION_PATTERNS = [
  { pattern: /chase.*credit|chase.*ink|chase.*card/i, account: "Chase CC x3418", type: "credit_card", owner: "steel_hearts" },
  { pattern: /chase.*check|chase.*bank/i, account: "Chase Checking x2352", type: "checking", owner: "steel_hearts" },
  { pattern: /chase/i, account: "Chase", type: "unknown", owner: "steel_hearts" },
  { pattern: /alliant/i, account: "Alliant Credit Union", type: "loan", owner: "personal" },
  { pattern: /freedom.*mortgage/i, account: "Freedom Mortgage", type: "mortgage", owner: "personal" },
  { pattern: /service.*finance/i, account: "Service Finance", type: "loan", owner: "personal" },
  { pattern: /usaa/i, account: "USAA", type: "checking", owner: "personal" },
];

function detectInstitution(from, subject) {
  const combined = `${from} ${subject}`;
  for (const inst of INSTITUTION_PATTERNS) {
    if (inst.pattern.test(combined)) return inst;
  }
  return { account: "Unknown", type: "unknown", owner: "unknown" };
}

/**
 * POST /api/finance/statements
 * Process a statement from an email — download PDF, archive to Supabase + Drive, create record.
 *
 * Body: { messageId, mailbox?, month?, year? }
 *   - messageId: Gmail message ID containing the statement
 *   - mailbox: optional mailbox key (defaults to "joseph")
 *   - month/year: override auto-detection
 *
 * OR Body: { action: "upload", accountName, accountType, owner, month, year, fileName }
 *   - Direct upload via form data (future: for manual PDF uploads)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { messageId, mailbox, month, year } = body;

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    // 1. Fetch the email
    const message = await getMessage(messageId, { mailbox });

    // 2. Find PDF attachment
    const pdfAttachment = message.attachments?.find(
      (a) => a.mimeType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf")
    );

    if (!pdfAttachment) {
      return NextResponse.json(
        { error: "No PDF attachment found in this email" },
        { status: 400 }
      );
    }

    // 3. Download the attachment
    const pdfBuffer = await getAttachment(messageId, pdfAttachment.attachmentId, { mailbox });

    // 4. Detect institution from email metadata
    const institution = detectInstitution(message.from, message.subject);
    const stmtMonth = month || new Date(message.date).getMonth() + 1;
    const stmtYear = year || new Date(message.date).getFullYear();
    const monthStr = String(stmtMonth).padStart(2, "0");

    // 5. Upload to Supabase Storage
    const sb = getServerClient();
    const storagePath = `${institution.account.replace(/\s+/g, "-").toLowerCase()}/${stmtYear}/${monthStr}-statement.pdf`;

    const { error: uploadError } = await sb.storage
      .from("statements")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError.message);
      // Non-fatal — continue with Drive upload
    }

    // 6. Upload to Google Drive (if folder is configured)
    let driveUrl = null;
    const statementsFolderId = getStatementsFolderId();
    if (statementsFolderId) {
      try {
        const driveFileName = `${institution.account} - ${stmtYear}-${monthStr} Statement.pdf`;
        const stream = new Readable();
        stream.push(pdfBuffer);
        stream.push(null);

        const driveResult = await uploadFileToDrive(
          stream,
          driveFileName,
          "application/pdf",
          statementsFolderId
        );
        driveUrl = driveResult.webViewLink;
      } catch (driveErr) {
        console.error("Drive upload error:", driveErr.message);
        // Non-fatal — record without Drive link
      }
    }

    // 7. Create record in statements table
    const record = {
      account_name: institution.account,
      account_type: institution.type,
      owner: institution.owner,
      statement_month: stmtMonth,
      statement_year: stmtYear,
      pdf_storage_path: uploadError ? null : storagePath,
      pdf_drive_url: driveUrl,
      email_message_id: messageId,
    };

    const { data: saved, error: dbError } = await sb
      .from("statements")
      .upsert(record, { onConflict: "account_name,statement_year,statement_month" })
      .select()
      .single();

    if (dbError) {
      // Table might not exist yet — log but don't fail
      console.error("Statements table insert error:", dbError.message);
      return NextResponse.json({
        success: true,
        warning: "PDF archived but statement record failed — run create-statements-table.sql",
        storagePath: uploadError ? null : storagePath,
        driveUrl,
        institution,
      });
    }

    return NextResponse.json({
      success: true,
      statement: saved,
      storagePath,
      driveUrl,
      institution,
    });
  } catch (err) {
    console.error("Statement processing error:", err.message);
    return NextResponse.json(
      { error: "Statement processing failed", message: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/finance/statements
 * List statements with optional filters.
 * Query params: account, year, month, owner
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const owner = searchParams.get("owner");

    const sb = getServerClient();
    let query = sb
      .from("statements")
      .select("*")
      .order("statement_year", { ascending: false })
      .order("statement_month", { ascending: false });

    if (account) query = query.eq("account_name", account);
    if (year) query = query.eq("statement_year", parseInt(year));
    if (month) query = query.eq("statement_month", parseInt(month));
    if (owner) query = query.eq("owner", owner);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ statements: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
