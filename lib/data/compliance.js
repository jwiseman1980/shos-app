import { getServerClient } from "@/lib/supabase";

export async function getComplianceItems() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("compliance_items")
    .select("*, compliance_documents(count)")
    .order("sort_order")
    .order("due_date", { ascending: true });
  if (error) {
    console.error("Compliance query failed:", error.message);
    return [];
  }
  return (data || []).map(item => ({
    ...item,
    docCount: item.compliance_documents?.[0]?.count || 0,
    isOverdue: item.due_date && new Date(item.due_date) < new Date() && !['filed', 'confirmed', 'waived'].includes(item.status),
    daysUntilDue: item.due_date ? Math.ceil((new Date(item.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
  }));
}

export async function getComplianceItemById(id) {
  const sb = getServerClient();
  const [itemRes, docsRes] = await Promise.all([
    sb.from("compliance_items").select("*").eq("id", id).single(),
    sb.from("compliance_documents").select("*").eq("compliance_item_id", id).order("created_at", { ascending: false }),
  ]);
  if (itemRes.error) throw new Error(itemRes.error.message);
  return { item: itemRes.data, documents: docsRes.data || [] };
}

export async function updateComplianceStatus(id, status, notes) {
  const sb = getServerClient();
  const updateData = { status, updated_at: new Date().toISOString() };
  if (notes) updateData.notes = notes;
  if (status === 'filed' || status === 'confirmed') {
    updateData.last_filed_date = new Date().toISOString().split('T')[0];
  }
  const { data, error } = await sb
    .from("compliance_items")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getComplianceStats() {
  const items = await getComplianceItems();
  return {
    total: items.length,
    filed: items.filter(i => ['filed', 'confirmed'].includes(i.status)).length,
    overdue: items.filter(i => i.isOverdue).length,
    dueSoon: items.filter(i => i.daysUntilDue !== null && i.daysUntilDue >= 0 && i.daysUntilDue <= 30 && !['filed', 'confirmed', 'waived'].includes(i.status)).length,
    notStarted: items.filter(i => i.status === 'not_started').length,
  };
}
