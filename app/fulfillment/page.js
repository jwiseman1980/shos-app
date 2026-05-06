export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import FulfillmentQueue from "@/components/FulfillmentQueue";
import { listOrders } from "@/lib/shipstation";

async function fetchShipStation(status) {
  try {
    const res = await listOrders({
      orderStatus: status,
      sortBy: "OrderDate",
      sortDir: "ASC",
      pageSize: 200,
    });
    return res?.orders || [];
  } catch (err) {
    console.warn(`ShipStation ${status} fetch failed:`, err.message);
    return [];
  }
}

function mapOrder(o, status) {
  const items = (o.items || []).map((i) => ({
    sku: i.sku,
    name: i.name,
    qty: i.quantity || 1,
  }));
  return {
    key: `ss_${o.orderId}`,
    orderId: o.orderId,
    orderNumber: o.orderNumber || "",
    orderDate: o.orderDate,
    customer: o.shipTo?.name || o.billTo?.name || "",
    email: o.customerEmail || "",
    items,
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    status,
  };
}

export default async function FulfillmentPage() {
  let ssError = null;
  let awaiting = [];
  let onHold = [];

  try {
    [awaiting, onHold] = await Promise.all([
      fetchShipStation("awaiting_shipment"),
      fetchShipStation("on_hold"),
    ]);
  } catch (err) {
    ssError = err.message;
  }

  const all = [
    ...awaiting.map((o) => mapOrder(o, "awaiting_shipment")),
    ...onHold.map((o) => mapOrder(o, "on_hold")),
  ];

  // Oldest first; missing dates sort last so the "oldest" stat is real.
  all.sort((a, b) => {
    const ad = a.orderDate ? new Date(a.orderDate).getTime() : Infinity;
    const bd = b.orderDate ? new Date(b.orderDate).getTime() : Infinity;
    return ad - bd;
  });

  const total = all.length;
  const awaitingCount = awaiting.length;
  const onHoldCount = onHold.length;

  const oldest = all.find((o) => o.orderDate);
  const oldestDays = oldest?.orderDate
    ? Math.floor((Date.now() - new Date(oldest.orderDate).getTime()) / 86400000)
    : null;

  return (
    <PageShell
      title="Fulfillment Queue"
      subtitle="Outstanding orders in ShipStation — oldest first"
    >
      <div className="stat-grid">
        <StatBlock
          label="Outstanding"
          value={total}
          note="In ShipStation, not yet shipped"
          accent={total > 0 ? "var(--gold)" : "var(--status-green)"}
        />
        <StatBlock
          label="Ready to Ship"
          value={awaitingCount}
          note="Print, pack, ship"
          accent={awaitingCount > 0 ? "var(--status-green)" : "var(--text-dim)"}
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

      {ssError && (
        <div className="section">
          <DataCard title="ShipStation Error">
            <div style={{ color: "var(--status-red)", fontSize: 12 }}>
              {ssError}
            </div>
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
