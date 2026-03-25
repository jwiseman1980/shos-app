import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

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

    // Read volunteers file
    const filePath = path.join(process.cwd(), "data", "volunteers.json");
    const volunteers = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const volunteer = volunteers.find(
      (v) => v.email.toLowerCase() === user.email.toLowerCase()
    );
    if (!volunteer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, volunteer.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 10);
    volunteer.passwordHash = newHash;

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(volunteers, null, 2));

    return NextResponse.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("Change password error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
