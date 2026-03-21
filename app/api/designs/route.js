import { NextResponse } from "next/server";
import { createDesignTask, updateDesignStatus } from "@/lib/data/designs";

/**
 * POST /api/designs — Create a new design task
 * Body: { heroName, rank, branch, classYear, customText, notes, relatedOrderId }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { heroName } = body;

    if (!heroName) {
      return NextResponse.json(
        { error: "heroName is required" },
        { status: 400 }
      );
    }

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json({
        success: false,
        mock: true,
        message: "Notion not configured — design task not created",
      });
    }

    const page = await createDesignTask(body);

    return NextResponse.json({
      success: true,
      taskId: page.id,
      message: `Design task created for ${heroName}`,
    });
  } catch (error) {
    console.error("Failed to create design task:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/designs — Update a design task's status
 * Body: { pageId, status }
 */
export async function PATCH(request) {
  try {
    const { pageId, status } = await request.json();

    if (!pageId || !status) {
      return NextResponse.json(
        { error: "pageId and status are required" },
        { status: 400 }
      );
    }

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json({
        success: false,
        mock: true,
        message: "Notion not configured — status not saved",
      });
    }

    await updateDesignStatus(pageId, status);

    return NextResponse.json({
      success: true,
      message: `Design task status updated to "${status}"`,
    });
  } catch (error) {
    console.error("Failed to update design task:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
