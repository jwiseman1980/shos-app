import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sfQuery, sfUpdate } from "@/lib/salesforce";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    // Get current hash from SF
    const contacts = await sfQuery(
      `SELECT Id, App_Password_Hash__c FROM Contact WHERE Email = '${user.email.replace(/'/g, "\\'")}' LIMIT 1`
    );

    if (contacts.length === 0) {
      return NextResponse.json({ error: "User not found in Salesforce" }, { status: 404 });
    }

    const contact = contacts[0];

    // Verify current password
    if (!contact.App_Password_Hash__c) {
      return NextResponse.json({ error: "No password set — contact admin" }, { status: 400 });
    }

    const match = await bcrypt.compare(currentPassword, contact.App_Password_Hash__c);
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Hash new password and update SF
    const newHash = await bcrypt.hash(newPassword, 10);
    await sfUpdate("Contact", contact.Id, { App_Password_Hash__c: newHash });

    return NextResponse.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("Change password error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
