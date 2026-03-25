export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { sfQuery } from "@/lib/salesforce";

const tdStyle = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
const thStyle = {
  padding: "6px 10px", fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
};

async function getInventoryData() {
  if (process.env.SF_LIVE !== "true") return { heroes: [], totals: {} };

  const heroes = await sfQuery(
    `SELECT Id, Name, Lineitem_sku__c, On_Hand_7in__c, On_Hand_6in__c, Total_On_Hand__c, Cost_Per_Unit__c, Total_Inventory_Value__c, Active_Listing__c
     FROM Memorial_Bracelet__c
     WHERE Total_On_Hand__c > 0
     ORDER BY Total_On_Hand__c DESC`
  );

  const total7 = heroes.reduce((s, h) => s + (h.On_Hand_7in__c || 0), 0);
  const total6 = heroes.reduce((s, h) => s + (h.On_Hand_6in__c || 0), 0);
  const totalValue = heroes.reduce((s, h) => s + (h.Total_Inventory_Value__c || 0), 0);
  const skuCount = heroes.length;
  const lowStock = heroes.filter((h) => (h.Total_On_Hand__c || 0) <= 3).length;
  const outOfStock = heroes.filter((h) => (h.Total_On_Hand__c || 0) === 0).length;

  return {
    heroes: heroes.map((h) => ({
      id: h.Id,
      name: h.Name,
      sku: h.Lineitem_sku__c,
      qty7: h.On_Hand_7in__c || 0,
      qty6: h.On_Hand_6in__c || 0,
      total: h.Total_On_Hand__c || 0,
      cost: h.Cost_Per_Unit__c || 0,
      value: h.Total_Inventory_Value__c || 0,
      active: h.Active_Listing__c || false,
    })),
    totals: { total7, total6, totalAll: total7 + total6, totalValue, skuCount, lowStock },
  };
}

export default async function InventoryPage() {
  const { heroes, totals } = await getInventoryData();

  // Sort by last name (extract from hero name or SKU)
  const getLastName = (h) => {
    const sku = h.sku || "";
    const parts = sku.split("-");
    // Group bracelets don't have a simple last name — they have keywords like CLASS, SOAR, RUGBY, etc.
    const isGroup = /CLASS|SOAR|RUGBY|NIGHTSTALKERS|HKIA|NYNG|BP|SPRINT|MEMORIAL|FALLEN/i.test(sku);
    if (isGroup) return null;
    // Last segment before size suffix is the name
    const namePart = parts.length >= 2 ? parts[parts.length - 1].replace(/^(7|6|D)$/, "") || parts[parts.length - 2] : "";
    return namePart || h.name;
  };

  const individualHeroes = heroes.filter((h) => getLastName(h) !== null)
    .sort((a, b) => (getLastName(a) || "").localeCompare(getLastName(b) || ""));
  const groupBracelets = heroes.filter((h) => getLastName(h) === null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const lowStockItems = individualHeroes.filter((h) => h.total <= 3);
  const medStock = individualHeroes.filter((h) => h.total >= 4 && h.total < 10);
  const highStock = individualHeroes.filter((h) => h.total >= 10);

  return (
    <PageShell title="Inventory Burnout" subtitle="Legacy pre-made bracelet stock — burns down to zero">
      <div className="stat-grid">
        <StatBlock
          label="Total Bracelets"
          value={totals.totalAll?.toLocaleString() || 0}
          note={`${totals.total7?.toLocaleString()} x 7" + ${totals.total6?.toLocaleString()} x 6"`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Unique SKUs"
          value={totals.skuCount || 0}
          note="With inventory on hand"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Low Stock"
          value={totals.lowStock || 0}
          note="3 or fewer remaining"
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Inventory Value"
          value={totals.totalValue ? `$${totals.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "$0"}
          note="At cost"
          accent="var(--status-green)"
        />
      </div>

      <div className="section">
        <DataCard title="About This Inventory">
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
            This is legacy pre-made inventory from Bracelets For America. These bracelets are already manufactured and ready to ship.
            Once stock hits zero for a SKU, all future orders are manufactured on-demand using the xTool F2 Ultra.
            This page tracks the burnout — the transition from purchased inventory to in-house production.
            <strong style={{ color: "var(--text-bright)" }}> No restocking. When they're gone, they're gone.</strong>
          </div>
        </DataCard>
      </div>

      {lowStockItems.length > 0 && (
        <div className="section">
          <DataCard title={`Low Stock (${lowStockItems.length} SKUs with 3 or fewer)`}>
            <InventoryTable items={lowStockItems} />
          </DataCard>
        </div>
      )}

      {highStock.length > 0 && (
        <div className="section">
          <DataCard title={`High Stock (${highStock.length} SKUs with 10+)`}>
            <InventoryTable items={highStock} />
          </DataCard>
        </div>
      )}

      {medStock.length > 0 && (
        <div className="section">
          <DataCard title={`Medium Stock (${medStock.length} SKUs with 4-9)`}>
            <InventoryTable items={medStock} />
          </DataCard>
        </div>
      )}

      {groupBracelets.length > 0 && (
        <div className="section">
          <DataCard title={`Group / Unit Bracelets (${groupBracelets.length})`}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              Class, unit, and memorial event bracelets — not individual heroes.
            </div>
            <InventoryTable items={groupBracelets} />
          </DataCard>
        </div>
      )}
    </PageShell>
  );
}

function InventoryTable({ items }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            <th style={thStyle}>Hero</th>
            <th style={thStyle}>SKU</th>
            <th style={{ ...thStyle, textAlign: "center" }}>7"</th>
            <th style={{ ...thStyle, textAlign: "center" }}>6"</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Total</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h) => {
            const stockColor = h.total <= 1 ? "#ef4444" : h.total <= 3 ? "#f59e0b" : h.total <= 5 ? "#eab308" : "var(--text-bright)";
            return (
              <tr key={h.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 12 }}>{h.name}</span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-dim)" }}>{h.sku}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: "center", color: h.qty7 > 0 ? "var(--text-bright)" : "var(--text-dim)" }}>
                  {h.qty7}
                </td>
                <td style={{ ...tdStyle, textAlign: "center", color: h.qty6 > 0 ? "var(--text-bright)" : "var(--text-dim)" }}>
                  {h.qty6}
                </td>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: stockColor }}>
                  {h.total}
                </td>
                <td style={tdStyle}>
                  {h.active ? (
                    <span style={{ fontSize: 10, color: "var(--status-green)" }}>Active</span>
                  ) : (
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>Inactive</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
