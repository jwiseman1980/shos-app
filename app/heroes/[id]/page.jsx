export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import HeroDetail from "@/components/HeroDetail";
import { getServerClient } from "@/lib/supabase";

const BRACELET_BUCKET = "bracelet-designs";
const PHOTO_BUCKET = "hero-photos";

async function loadHero(id) {
  const sb = getServerClient();
  const { data: hero, error } = await sb
    .from("heroes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[heroes/:id] query failed:", error.message);
    return null;
  }
  if (!hero) return null;

  let family_contact = null;
  if (hero.family_contact_id) {
    const { data: contact } = await sb
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .eq("id", hero.family_contact_id)
      .maybeSingle();
    family_contact = contact || null;
  }

  let organization = null;
  if (hero.organization_id) {
    const { data: org } = await sb
      .from("organizations")
      .select("id, name")
      .eq("id", hero.organization_id)
      .maybeSingle();
    organization = org || null;
  }

  return { ...hero, family_contact, organization };
}

async function loadDesignFiles(sku) {
  if (!sku) return [];
  const sb = getServerClient();
  const { data } = await sb.storage.from(BRACELET_BUCKET).list(sku, { limit: 20 });
  if (!data) return [];

  return data
    .filter((f) => f.name.endsWith(".svg"))
    .map((f) => {
      const { data: urlData } = sb.storage
        .from(BRACELET_BUCKET)
        .getPublicUrl(`${sku}/${f.name}`);
      const sizeMatch = f.name.match(/-([67])\.svg$/);
      return {
        name: f.name,
        size: sizeMatch ? sizeMatch[1] : null,
        url: urlData?.publicUrl || "",
      };
    })
    .sort((a, b) => (a.size || "z").localeCompare(b.size || "z"));
}

async function loadPhotos(sku) {
  if (!sku) return [];
  const sb = getServerClient();
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).list(sku, { limit: 50 });
  if (error || !data) return [];

  return data
    .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
    .map((f) => {
      const { data: urlData } = sb.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(`${sku}/${f.name}`);
      return { name: f.name, url: urlData?.publicUrl || "" };
    });
}

async function loadOrderStats(sku) {
  if (!sku) return { total: 0, retail: 0, wholesale: 0, donated: 0 };
  const sb = getServerClient();
  const { data, error } = await sb
    .from("order_items")
    .select("quantity, lineitem_sku, orders!inner(order_type)")
    .like("lineitem_sku", `${sku}%`);

  if (error || !data) return { total: 0, retail: 0, wholesale: 0, donated: 0 };

  const stats = { total: 0, retail: 0, wholesale: 0, donated: 0 };
  for (const item of data) {
    const qty = item.quantity || 1;
    stats.total += qty;
    const type = item.orders?.order_type || "paid";
    if (type === "wholesale") stats.wholesale += qty;
    else if (type === "donated" || type === "gift") stats.donated += qty;
    else stats.retail += qty;
  }
  return stats;
}

export default async function HeroDetailPage({ params }) {
  const { id } = await params;
  const hero = await loadHero(id);
  if (!hero) notFound();

  const sku = hero.lineitem_sku;
  const [designs, photos, orders] = await Promise.all([
    loadDesignFiles(sku),
    loadPhotos(sku),
    loadOrderStats(sku),
  ]);

  return (
    <PageShell
      title={hero.name}
      subtitle={
        <Link href="/heroes" style={{ color: "var(--text-dim)", fontSize: 12 }}>
          ← Hero Catalog
        </Link>
      }
    >
      <HeroDetail
        hero={hero}
        designs={designs}
        photos={photos}
        orders={orders}
      />
    </PageShell>
  );
}
