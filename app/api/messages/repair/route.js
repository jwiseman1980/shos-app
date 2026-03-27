import { NextResponse } from "next/server";

/**
 * POST /api/messages/repair
 * Scans all Family_Message__c records for mojibake and updates them in SF.
 *
 * Body: { dryRun: true } — preview what would be fixed (default)
 *       { dryRun: false } — actually update SF records
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default true for safety

    const { getAllMessages } = await import("@/lib/data/messages");
    const { repairMojibake, hasMojibake } = await import("@/lib/text-repair");

    const all = await getAllMessages();

    // Find records that need repair
    const needsRepair = [];
    for (const msg of all) {
      if (hasMojibake(msg.message)) {
        const fixed = repairMojibake(msg.message);
        if (fixed !== msg.message) {
          needsRepair.push({
            sfId: msg.sfId,
            name: msg.name,
            fromName: msg.fromName,
            braceletName: msg.braceletName,
            before: msg.message.slice(0, 100),
            after: fixed.slice(0, 100),
            fullFixed: fixed,
          });
        }
      }

      // Also check fromName
      if (hasMojibake(msg.fromName)) {
        const fixedName = repairMojibake(msg.fromName);
        if (fixedName !== msg.fromName) {
          // We'll handle name repairs in the same pass
          const existing = needsRepair.find((r) => r.sfId === msg.sfId);
          if (existing) {
            existing.fixedName = fixedName;
            existing.originalName = msg.fromName;
          } else {
            needsRepair.push({
              sfId: msg.sfId,
              name: msg.name,
              fromName: msg.fromName,
              braceletName: msg.braceletName,
              before: msg.fromName,
              after: fixedName,
              fixedName: fixedName,
              originalName: msg.fromName,
              fullFixed: msg.message, // unchanged
            });
          }
        }
      }
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        totalRecords: all.length,
        needsRepair: needsRepair.length,
        preview: needsRepair.slice(0, 20).map((r) => ({
          sfId: r.sfId,
          name: r.name,
          braceletName: r.braceletName,
          messageBefore: r.before,
          messageAfter: r.after,
          nameBefore: r.originalName || null,
          nameAfter: r.fixedName || null,
        })),
      });
    }

    // Actually update SF records
    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json({
        success: false,
        error: "SF_LIVE is not enabled",
        mock: true,
      });
    }

    const { sfUpdate } = await import("@/lib/salesforce");
    const results = { updated: 0, failed: 0, errors: [] };

    for (const record of needsRepair) {
      try {
        const updateData = {};
        if (record.fullFixed && record.fullFixed !== record.before) {
          updateData.Message__c = record.fullFixed;
        }
        if (record.fixedName) {
          updateData.From_Name__c = record.fixedName;
        }
        if (Object.keys(updateData).length > 0) {
          await sfUpdate("Family_Message__c", record.sfId, updateData);
          results.updated++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ sfId: record.sfId, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      totalRecords: all.length,
      needsRepair: needsRepair.length,
      ...results,
      message: `Updated ${results.updated} of ${needsRepair.length} records${results.failed > 0 ? ` (${results.failed} failed)` : ""}`,
    });
  } catch (error) {
    console.error("Message repair error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
