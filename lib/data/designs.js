import { getServerClient } from "@/lib/supabase";

/**
 * Get all heroes with active design tasks (Queued, In Progress, Submitted)
 */
export async function getDesignQueue() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("heroes")
      .select("*")
      .in("design_status", ["Queued", "In Progress", "Submitted"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRecord);
  } catch (err) {
    console.error("Design queue load error:", err.message);
    return [];
  }
}

/**
 * Get heroes that NEED design but haven't been queued yet
 */
export async function getNeedsDesign() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("heroes")
      .select("*")
      .eq("bracelet_design_created", false)
      .eq("has_graphic_design", false)
      .eq("active_listing", false)
      .or("design_status.eq.Not requested,design_status.is.null")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data || []).map(mapRecord);
  } catch (err) {
    console.error("Needs design load error:", err.message);
    return [];
  }
}

/**
 * Get design stats
 */
export async function getDesignStats() {
  try {
    const sb = getServerClient();

    const countByStatus = async (status) => {
      const { count, error } = await sb
        .from("heroes")
        .select("id", { count: "exact", head: true })
        .eq("design_status", status);
      return error ? 0 : count;
    };

    const [queued, inProgress, submitted, complete] = await Promise.all([
      countByStatus("Queued"),
      countByStatus("In Progress"),
      countByStatus("Submitted"),
      countByStatus("Complete"),
    ]);

    // Needs design: no design created, not active, status is null or "Not requested"
    const { count: needsDesign, error: ndErr } = await sb
      .from("heroes")
      .select("id", { count: "exact", head: true })
      .eq("bracelet_design_created", false)
      .eq("has_graphic_design", false)
      .eq("active_listing", false)
      .or("design_status.eq.Not requested,design_status.is.null");

    return {
      queued,
      inProgress,
      submitted,
      complete,
      needsDesign: ndErr ? 0 : needsDesign,
    };
  } catch (err) {
    console.error("Design stats error:", err.message);
    return { queued: 0, inProgress: 0, submitted: 0, needsDesign: 0, complete: 0 };
  }
}

function mapRecord(r) {
  return {
    id: r.sf_id || r.id,
    name: r.name,
    rank: r.rank || "",
    sku: r.lineitem_sku || "",
    branch: r.service_academy_or_branch || "",
    memorialDate: r.memorial_date,
    designStatus: r.design_status || "Not requested",
    designPriority: r.design_priority || "Normal",
    designBrief: r.design_brief || "",
    designDueDate: r.design_due_date,
    hasDesign: r.bracelet_design_created || r.has_graphic_design || false,
    pipelineStage: r.pipeline_stage || "",
    activeListing: r.active_listing || false,
    incident: r.incident || "",
    createdDate: r.created_at,
  };
}
