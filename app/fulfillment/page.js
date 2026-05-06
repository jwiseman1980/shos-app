export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import FulfillmentQueue from "@/components/FulfillmentQueue";
import { getServerClient } from "@/lib/supabase";
import { listOrders } from "@/lib/shipstation";

async function fetchShipStation(status) {
  try {
    const res = await listOrders({
      orderStatus: status,
      sortBy: "OrderDate",
      sortDir: "DESC",
      pageSize: 200,
    });
    return res?.orders || [];
  } catch (err) {
    console.warn(`ShipStation ${status} fetch failed:`, err.message);
    return [];
  }
}

export default async function FulfillmentPage() {
  let ssAwaiting = [];
  let ssOnHold = [];
  let ssError = null;

  try {
    [ssAwaiting, ssOnHold] = await Promise.all([
      fetchShipStation("awaiting_shipment"),
      fetchShipStation("on_hold"),
    ]);
  } catch (err) {
    ssError = err.message;
  }

  const sb = getServerClient();
  let openItems = [];
  let sbError = null;
  try {
    // An order is "unfulfilled" if any item is not yet shipped/delivered/cancelled.
    // We DON'T surface the underlying production stage in the UI — Joseph wants a
    // simple unfulfilled/fulfilled distinction. The lasering step happens
    // physically and isn't tracked here.
    const { data, error } = await sb
      .from("order_items")
      .select(`
        id, lineitem_sku, quantity, bracelet_size,
        order:orders!order_id(
          id, order_number, order_date, order_type, source,
          billing_name, shipping_name, billing_email
        ),
        hero:heroes!hero_id(name)
      `)
      .not("production_status", "in", '("shipped","cancelled","delivered")')
      .limit(1000);
    if (error) throw error;
    openItems = data || [];
  } catch (err) {
    sbError = err.message;
  }

  // Group Supabase open items by order
  const sbByOrder = new Map();
  for (const item of openItems) {
    const o = item.order;
    if (!o) continue;
    const key = o.order_number || `__id_${o.id}`;
    if (!sbByOrder.has(key)) {
      sbByOrder.set(key, {
        key,
        orderNumber: o.order_number || "",
        orderDate: o.order_date,
        customer: o.shipping_name || o.billing_name || "",
        email: o.billing_email || "",
        orderType: o.order_type || "paid",
        source: o.source || "manual",
        items: [],
        inShipStation: false,
        totalQty: 0,
      });
    }
    const grp = sbByOrder.get(key);
    grp.items.push({
      sku: item.lineitem_sku,
      hero: item.hero?.name,
      qty: item.quantity || 1,
      size: item.bracelet_size,
    });
    grp.totalQty += item.quantity || 1;
  }

  // Mark Supabase orders that ALSO appear in ShipStation
  const ssAwaitingMap = new Map(ssAwaiting.map(o => [o.orderNumber, o]));
  const ssOnHoldMap = new Map(ssOnHold.map(o => [o.orderNumber, o]));

  for (const grp of sbByOrder.values()) {
    if (grp.orderNumber && ssOnHoldMap.has(grp.orderNumber)) {
      grp.status = "on_hold";
      grp.inShipStation = true;
    } else if (grp.orderNumber && ssAwaitingMap.has(grp.orderNumber)) {
      grp.status = "awaiting_shipment";
      grp.inShipStation = true;
    } else {
      grp.status = "in_progress";
    }
  }

  // ShipStation orders that are NOT in Supabase (rare — sync gap or store mismatch)
  const ssOnly = [];
  for (const status of ["on_hold", "awaiting_shipment"]) {
    const list = status === "on_hold" ? ssOnHold : ssAwaiting;
    for (const o of list) {
      if (sbByOrder.has(o.orderNumber)) continue;
      const items = (o.items || []).map(i => ({
        sku: i.sku, hero: i.name, qty: i.quantity || 1, size: null,
      }));
      ssOnly.push({
        key: `ss_${o.orderId}`,
        orderNumber: o.orderNumber || "",
        orderDate: o.orderDate,
        customer: o.shipTo?.name || "",
        email: o.customerEmail || "",
        orderType: "paid",
        source: "shipstation",
        items,
        totalQty: items.reduce((s, i) => s + i.qty, 0),
        status,
        inShipStation: true,
      });
    }
  }

  // Combined unified list — orders with no date sort to the bottom so the
  // "oldest" stat reflects real order age, not missing-date artifacts.
  const all = [...sbByOrder.values(), ...ssOnly];
  all.sort((a, b) => {
    const ad = a.orderDate ? new Date(a.orderDate).getTime() : Infinity;
    const bd = b.orderDate ? new Date(b.orderDate).getTime() : Infinity;
    return ad - bd;
  });

  const total = all.length;
  const awaitingShip = all.filter(o => o.status === "awaiting_shipment").length;
  const onHoldCount  = all.filter(o => o.status === "on_hold").length;

  // Oldest unshipped order with a known date
  const oldest = all.find(o => o.orderDate);
  const oldestDays = oldest?.orderDate
    ? Math.floor((Date.now() - new Date(oldest.orderDate).getTime()) / 86400000)
    : null;

  return (
    <PageShell
      title="Fulfillment Queue"
      subtitle="Outstanding orders that need to ship — oldest first"
    >
      <div className="stat-grid">
        <StatBlock
          label="Total Outstanding"
          value={total}
          note="Orders not yet shipped"
          accent={total > 0 ? "var(--gold)" : "var(--status-green)"}
        />
        <StatBlock
          label="Ready to Ship"
          value={awaitingShip}
          note="In ShipStation — print, pack, ship"
          accent={awaitingShip > 0 ? "var(--status-green)" : "var(--text-dim)"}
        />
        {onHoldCount > 0 && (
          <StatBlock
            label="On Hold"
            value={onHoldCount}
            note="Need attention"
            accent="var(--status-red)"
          />
        )}
        <StatBlock
          label="Oldest Unshipped"
          value={oldestDays != null ? `${oldestDays}d` : "—"}
          note={oldest?.orderNumber ? `#${oldest.orderNumber}` : "All clear"}
          accent={
            oldestDays == null ? "var(--text-dim)" :
            oldestDays >= 14 ? "var(--status-red)" :
            oldestDays >= 7  ? "var(--status-orange)" :
                                "var(--status-green)"
          }
        />
      </div>

      {(ssError || sbError) && (
        <div className="section">
          <DataCard title="Data Source Issues">
            {ssError && (
              <div style={{ color: "var(--status-orange)", fontSize: 12, marginBottom: 4 }}>
                ShipStation: {ssError}
              </div>
            )}
            {sbError && (
              <div style={{ color: "var(--status-red)", fontSize: 12 }}>
                Supabase: {sbError}
              </div>
            )}
          </DataCard>
        </div>
      )}

      <div className="section">
        <DataCard title={`Outstanding Orders (${total})`}>
          <FulfillmentQueue orders={all} />
        </DataCard>
      </div>
    </PageShell>
  );
}
