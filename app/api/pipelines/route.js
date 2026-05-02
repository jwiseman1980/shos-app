import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANNIVERSARY_DONE = new Set(["email_sent", "sent", "scheduled", "social_posted", "complete", "skipped"]);
const DESIGN_DONE = new Set(["complete", "approved", "laser_ready", "delivered"]);

const ORDER_STAGE_MAP = {
  not_started:    "Intake",
  design_needed:  "Design Check",
  ready_to_laser: "Ready to Laser",
  in_production:  "In Production",
  ready_to_ship:  "QC / Pack",
  shipped:        "Shipped",
  delivered:      "Shipped",
  complete:       "Shipped",
  completed:      "Shipped",
};

const DESIGN_STAGE_MAP = {
  pending:       "Brief Needed",
  brief_created: "Brief Sent",
  assigned:      "In Progress",
  in_progress:   "In Progress",
  proof_ready:   "Proof Ready",
  review:        "Proof Ready",
  approved:      "Approved",
  complete:      "Approved",
  laser_ready:   "Approved",
};

const ANNIVERSARY_STAGE_MAP = {
  not_started:   "Not Started",
  prep:          "Prep",
  assigned:      "Prep",
  email_drafted: "Drafted",
  email_sent:    "Sent",
  sent:          "Sent",
  scheduled:     "Sent",
  social_posted: "Sent",
  complete:      "Complete",
  skipped:       "Complete",
};

// ---------------------------------------------------------------------------
// Orders pipeline
// ---------------------------------------------------------------------------

async function getOrdersPipeline() {
  const sb = getServerClient();
  // Only valid production_status enum values; "complete"/"completed" are
  // legacy strings that aren't in the DB enum.
  const TERMINAL = ["shipped", "delivered", "cancelled"];

  const { data, error } = await sb
    .from("order_items")
    .select("id, lineitem_sku, quantity, production_status, order_id, hero_id, notes")
    .not("production_status", "in", `(${TERMINAL.map((s) => `"${s}"`).join(",")})`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[pipelines] order_items query failed:", error.message);
    return {};
  }

  // Resolve hero names + parent orders in batch
  const heroIds = [...new Set((data || []).map((r) => r.hero_id).filter(Boolean))];
  const orderIds = [...new Set((data || []).map((r) => r.order_id).filter(Boolean))];

  const [heroesRes, ordersRes] = await Promise.all([
    heroIds.length
      ? sb.from("heroes").select("id, name").in("id", heroIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? sb.from("orders").select("id, order_number, order_type, billing_email, shipping_address1, shipping_city").in("id", orderIds)
      : Promise.resolve({ data: [] }),
  ]);

  const heroMap = new Map((heroesRes.data || []).map((h) => [h.id, h]));
  const orderMap = new Map((ordersRes.data || []).map((o) => [o.id, o]));

  const byStage = {
    "Intake": [],
    "Design Check": [],
    "Ready to Laser": [],
    "In Production": [],
    "QC / Pack": [],
    "Shipped": [],
  };

  for (const row of data || []) {
    const stage = ORDER_STAGE_MAP[row.production_status] || "Intake";
    const statusLabel = (row.production_status || "").replace(/_/g, " ");
    const ord = orderMap.get(row.order_id) || {};
    const hero = row.hero_id ? heroMap.get(row.hero_id) : null;
    const heroName = hero?.name || "";
    byStage[stage]?.push({
      id: `order-${row.id}`,
      pipeline: "orders",
      itemId: row.id,
      heroId: row.hero_id || null,
      heroName,
      orderId: ord.id || row.order_id,
      orderType: ord.order_type || null,
      orderNumber: ord.order_number || null,
      productionStatus: row.production_status,
      hasShipAddress: Boolean(ord.shipping_address1 || ord.shipping_city),
      title: heroName || `Order #${ord.order_number || row.order_id || row.id}`,
      subtitle: `${row.quantity || "?"} units · ${row.lineitem_sku || ""}`,
      brief: `${row.quantity || "?"} unit${(row.quantity || 1) !== 1 ? "s" : ""}${heroName ? ` for ${heroName}` : ""} — ${statusLabel}.${row.notes ? " " + row.notes : ""}`,
      actions: [
        { label: "View Order", href: `/orders` },
      ],
    });
  }

  return byStage;
}

// ---------------------------------------------------------------------------
// Designs pipeline
// ---------------------------------------------------------------------------

async function getDesignsPipeline() {
  const sb = getServerClient();

  const { data, error } = await sb
    .from("heroes")
    .select("id, name, first_name, last_name, rank, lineitem_sku, design_status, design_brief, has_graphic_design")
    .eq("active_listing", true)
    .order("design_priority", { ascending: true, nullsFirst: false })
    .limit(40);

  if (error) return {};

  const byStage = {
    "Brief Needed": [],
    "Brief Sent": [],
    "In Progress": [],
    "Proof Ready": [],
    "Approved": [],
  };

  for (const hero of data || []) {
    if (hero.has_graphic_design || DESIGN_DONE.has(hero.design_status)) continue;
    const stage = DESIGN_STAGE_MAP[hero.design_status] || "Brief Needed";
    const fullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;
    byStage[stage]?.push({
      id: `design-${hero.id}`,
      pipeline: "designs",
      heroId: hero.id,
      designStatus: hero.design_status || "not_started",
      title: fullName,
      subtitle: hero.lineitem_sku || "",
      brief: hero.design_brief?.slice(0, 120) || `${hero.lineitem_sku || hero.name} needs a design brief.`,
      actions: [
        { label: "Design Queue", href: "/designs" },
      ],
    });
  }

  return byStage;
}

// ---------------------------------------------------------------------------
// Anniversaries pipeline
// ---------------------------------------------------------------------------

async function getAnniversariesPipeline() {
  const sb = getServerClient();
  const now = new Date();

  const { data, error } = await sb
    .from("heroes")
    .select(`
      id, sf_id, name, first_name, last_name, rank,
      memorial_month, memorial_day, anniversary_status,
      family_contact:contacts_legacy!family_contact_id(first_name, last_name, email)
    `)
    .eq("active_listing", true)
    .not("memorial_month", "is", null)
    .eq("memorial_type", "individual")
    .limit(60);

  if (error) return {};

  const byStage = {
    "Not Started": [],
    "Prep": [],
    "Drafted": [],
    "Sent": [],
    "Complete": [],
  };

  for (const hero of data || []) {
    let memDate = new Date(now.getFullYear(), hero.memorial_month - 1, hero.memorial_day);
    if (memDate < now) memDate.setFullYear(now.getFullYear() + 1);
    const daysUntil = Math.ceil((memDate - now) / (1000 * 60 * 60 * 24));

    // Only show heroes with anniversaries in next 90 days
    if (daysUntil > 90) continue;

    const stage = ANNIVERSARY_STAGE_MAP[hero.anniversary_status] || "Not Started";
    const fullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;
    const dateStr = new Date(now.getFullYear(), hero.memorial_month - 1, hero.memorial_day)
      .toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fc = hero.family_contact;
    const familyName = fc ? `${fc.first_name || ""} ${fc.last_name || ""}`.trim() : null;

    byStage[stage]?.push({
      id: `anniversary-${hero.id}`,
      pipeline: "anniversaries",
      heroId: hero.id,
      sfId: hero.sf_id,
      anniversaryStatus: hero.anniversary_status || "not_started",
      title: fullName,
      subtitle: `${dateStr} · ${daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d away`}`,
      brief: familyName
        ? `Family contact: ${familyName}${fc?.email ? ` (${fc.email})` : ""}. Outreach status: ${(hero.anniversary_status || "not started").replace(/_/g, " ")}.`
        : "No family contact on file.",
      actions: [
        { label: "Anniversaries", href: "/anniversaries" },
      ],
    });
  }

  return byStage;
}

// ---------------------------------------------------------------------------
// Heroes pipeline (intake → design → live)
// ---------------------------------------------------------------------------

async function getHeroesPipeline() {
  const sb = getServerClient();

  const { data, error } = await sb
    .from("heroes")
    .select("id, name, first_name, last_name, rank, lineitem_sku, active_listing, has_graphic_design, design_status, bracelet_design_created, bio_page_url")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return {};

  const byStage = {
    "Intake": [],
    "Design": [],
    "Live": [],
  };

  for (const hero of data || []) {
    const fullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;

    if (hero.active_listing) {
      byStage["Live"].push({
        id: `hero-live-${hero.id}`,
        pipeline: "heroes",
        heroId: hero.id,
        lifecycleStage: "live",
        title: fullName,
        subtitle: hero.lineitem_sku || "",
        brief: `${fullName} is live with active listing.`,
        actions: [{ label: "View Hero", href: "/heroes" }],
      });
    } else if (hero.has_graphic_design || DESIGN_DONE.has(hero.design_status)) {
      byStage["Design"].push({
        id: `hero-design-${hero.id}`,
        pipeline: "heroes",
        heroId: hero.id,
        lifecycleStage: "design",
        title: fullName,
        subtitle: hero.lineitem_sku || "",
        brief: `Design complete — ready to publish as active listing.`,
        actions: [{ label: "Heroes", href: "/heroes" }],
      });
    } else {
      byStage["Intake"].push({
        id: `hero-intake-${hero.id}`,
        pipeline: "heroes",
        heroId: hero.id,
        lifecycleStage: "intake",
        title: fullName,
        subtitle: hero.lineitem_sku || "Needs SKU",
        brief: `In intake — needs design brief${!hero.lineitem_sku ? " and SKU" : ""}.`,
        actions: [{ label: "Heroes", href: "/heroes" }],
      });
    }
  }

  return byStage;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  const [orders, designs, anniversaries, heroes] = await Promise.allSettled([
    getOrdersPipeline(),
    getDesignsPipeline(),
    getAnniversariesPipeline(),
    getHeroesPipeline(),
  ]);

  const get = (r) => (r.status === "fulfilled" ? r.value : {});

  return Response.json({
    orders:       get(orders),
    designs:      get(designs),
    anniversaries: get(anniversaries),
    heroes:       get(heroes),
    generatedAt:  new Date().toISOString(),
  });
}
