import { NextResponse } from "next/server";
import { isAuthenticated, getSessionUser } from "@/lib/auth";
import { logExecution } from "@/lib/execution-logger";

export async function POST(request) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getSessionUser();
  const body = await request.json();

  const result = await logExecution({
    userName: user?.name || body.userName,
    ...body,
  });

  return NextResponse.json(result);
}
