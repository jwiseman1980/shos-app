"use client";

import { useState } from "react";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";

const STEPS = [
  { key: "hero", label: "Hero Record", flag: "heroCreated" },
  { key: "contact", label: "Family Contact", flag: "familyLinked" },
  { key: "charity", label: "Charity", flag: "charitySet" },
  { key: "design", label: "Design Brief", flag: "designBriefSet" },
  { key: "order", label: "Donated Order", flag: "orderCreated" },
  { key: "summary", label: "Summary", flag: null },
];

const RANKS = [
  "PVT", "PV2", "PFC", "SPC", "CPL", "SGT", "SSG", "SFC", "MSG", "1SG", "SGM", "CSM",
  "2LT", "1LT", "CPT", "MAJ", "LTC", "COL", "BG", "MG", "LTG", "GEN",
  "SR", "SA", "SN", "PO3", "PO2", "PO1", "CPO", "SCPO", "MCPO",
  "ENS", "LTJG", "LT", "LCDR", "CDR", "CAPT", "RADM", "VADM", "ADM",
  "Pvt", "LCpl", "Cpl", "Sgt", "SSgt", "GySgt", "MSgt", "1stSgt", "MGySgt", "SgtMaj",
  "AB", "Amn", "A1C", "SrA", "TSgt", "MSgt", "SMSgt", "CMSgt",
];

const BRANCHES = [
  "U.S. Army",
  "U.S. Marine Corps",
  "U.S. Navy",
  "U.S. Air Force",
  "U.S. Coast Guard",
  "U.S. Space Force",
];

const RELATIONSHIPS = [
  "Surviving Family",
  "Extended Family",
  "Purchaser",
  "Organization Contact",
];

export default function FamilyIntakeWizard({ intakes: initialIntakes }) {
  const [mode, setMode] = useState("list"); // "list" or "wizard"
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [intakes, setIntakes] = useState(initialIntakes || []);

  // Data accumulated through the wizard
  const [heroData, setHeroData] = useState({
    firstName: "", lastName: "", middleInitial: "", rank: "", branch: "", memorialDate: "",
  });
  const [heroResult, setHeroResult] = useState(null); // { heroId, name, sku }

  const [contactData, setContactData] = useState({
    firstName: "", lastName: "", email: "", phone: "", relationship: "Surviving Family",
    mailingStreet: "", mailingCity: "", mailingState: "", mailingPostalCode: "",
  });
  const [contactResult, setContactResult] = useState(null);

  const [charityName, setCharityName] = useState("");
  const [charityResult, setCharityResult] = useState(null);

  const [designBrief, setDesignBrief] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]); // [{ url, filename, size }]
  const [uploading, setUploading] = useState(false);
  const [designResult, setDesignResult] = useState(null);

  const [orderData, setOrderData] = useState({
    quantity7: 1, quantity6: 0, notes: "",
    shippingName: "", shippingAddress1: "", shippingCity: "", shippingState: "", shippingPostal: "",
  });
  const [orderResult, setOrderResult] = useState(null);

  // Resume an existing intake
  function resumeIntake(intake) {
    setHeroResult({ heroId: intake.heroId, name: intake.name, sku: intake.sku });
    setHeroData({
      firstName: intake.firstName || "", lastName: intake.lastName || "",
      rank: intake.rank || "", branch: intake.branch || "",
      memorialDate: intake.memorialDate || "", middleInitial: "",
    });

    if (intake.familyContact) {
      setContactResult({ contactId: intake.familyContact.id, contactName: intake.familyContact.name });
    }
    if (intake.charity) {
      setCharityResult({ accountId: intake.charity.id, orgName: intake.charity.name });
      setCharityName(intake.charity.name);
    }
    if (intake.designBrief) {
      setDesignBrief(intake.designBrief);
      setDesignResult({ success: true });
    }

    // Find next incomplete step
    const steps = intake.steps;
    if (!steps.familyLinked) setCurrentStep(1);
    else if (!steps.charitySet) setCurrentStep(2);
    else if (!steps.designBriefSet) setCurrentStep(3);
    else if (!steps.orderCreated) setCurrentStep(4);
    else setCurrentStep(5);

    setMode("wizard");
  }

  function startNew() {
    setHeroData({ firstName: "", lastName: "", middleInitial: "", rank: "", branch: "", memorialDate: "" });
    setHeroResult(null);
    setContactData({ firstName: "", lastName: "", email: "", phone: "", relationship: "Surviving Family" });
    setContactResult(null);
    setCharityName("");
    setCharityResult(null);
    setDesignBrief("");
    setDesignResult(null);
    setOrderData({ quantity7: 1, quantity6: 0, notes: "" });
    setOrderResult(null);
    setCurrentStep(0);
    setError(null);
    setMode("wizard");
  }

  // --- API calls for each step ---
  async function submitHero() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/families/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(heroData),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create hero");
      setHeroResult(data);
      setCurrentStep(1);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function submitContact() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/families/intake/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId: heroResult.heroId,
          heroName: heroResult.name,
          ...contactData,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create contact");
      setContactResult(data);
      // Pre-fill order shipping from contact address
      if (data.address || contactData.mailingStreet) {
        setOrderData((prev) => ({
          ...prev,
          shippingName: `${contactData.firstName} ${contactData.lastName}`,
          shippingAddress1: data.address?.street || contactData.mailingStreet || "",
          shippingCity: data.address?.city || contactData.mailingCity || "",
          shippingState: data.address?.state || contactData.mailingState || "",
          shippingPostal: data.address?.postalCode || contactData.mailingPostalCode || "",
        }));
      }
      setCurrentStep(2);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function submitCharity() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/families/intake/charity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId: heroResult.heroId, orgName: charityName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to set charity");
      setCharityResult(data);
      setCurrentStep(3);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function submitDesign() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/families/intake/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId: heroResult.heroId,
          heroName: heroResult.name,
          designBrief,
          imageUrls: uploadedImages.map((img) => img.url),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to set design");
      setDesignResult(data);
      setCurrentStep(4);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function submitOrder() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/families/intake/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: heroResult.name,
          recipientName: contactResult?.contactName || heroResult.name,
          recipientEmail: contactData.email,
          sku: heroResult.sku,
          quantity7: orderData.quantity7,
          quantity6: orderData.quantity6,
          notes: orderData.notes,
          shippingName: orderData.shippingName || contactResult?.contactName || heroResult.name,
          shippingAddress1: orderData.shippingAddress1,
          shippingCity: orderData.shippingCity,
          shippingState: orderData.shippingState,
          shippingPostal: orderData.shippingPostal,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create order");
      setOrderResult(data);
      setCurrentStep(5);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  // --- Step completion check ---
  function stepComplete(idx) {
    switch (idx) {
      case 0: return !!heroResult;
      case 1: return !!contactResult;
      case 2: return !!charityResult;
      case 3: return !!designResult;
      case 4: return !!orderResult;
      case 5: return false;
      default: return false;
    }
  }

  // --- Renders ---
  if (mode === "list") {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, color: "#e0e0e0" }}>Active Intakes</h3>
          <button onClick={startNew} className="btn-primary">
            + New Family Intake
          </button>
        </div>

        {intakes.length === 0 ? (
          <DataCard title="No active intakes">
            <p style={{ color: "#999" }}>Start a new intake when a family reaches out about a memorial bracelet.</p>
          </DataCard>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {intakes.map((intake) => {
              const done = Object.values(intake.steps).filter(Boolean).length;
              const total = Object.keys(intake.steps).length;
              return (
                <DataCard key={intake.heroId} title={intake.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#aaa", fontSize: "0.85rem" }}>
                        {intake.branch} &middot; {intake.sku} &middot; Started {new Date(intake.createdDate).toLocaleDateString()}
                      </div>
                      {intake.familyContact && (
                        <div style={{ color: "#60a5fa", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                          Contact: {intake.familyContact.name}{intake.familyContact.email ? ` (${intake.familyContact.email})` : ""}
                        </div>
                      )}
                      {intake.charity && (
                        <div style={{ color: "#a78bfa", fontSize: "0.8rem", marginTop: "0.1rem" }}>
                          Charity: {intake.charity.name}
                        </div>
                      )}
                      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {STEPS.slice(0, 5).map((s, i) => (
                          <StatusBadge
                            key={s.key}
                            status={intake.steps[s.flag] ? "complete" : "not_assigned"}
                            label={s.label}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => resumeIntake(intake)}
                      style={{
                        background: done >= total ? "transparent" : "var(--gold, #d4a843)",
                        color: done >= total ? "#aaa" : "#000",
                        border: done >= total ? "1px solid #555" : "1px solid var(--gold, #d4a843)",
                        borderRadius: "6px",
                        padding: "0.5rem 1.25rem",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "0.85rem",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = "0.85"}
                      onMouseLeave={(e) => e.target.style.opacity = "1"}
                    >
                      {done >= total ? "View" : `Resume \u2192`}
                    </button>
                  </div>
                </DataCard>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- WIZARD MODE ---
  return (
    <div>
      {/* Back button */}
      <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", marginBottom: "1rem", padding: 0 }}>
        &larr; Back to intakes
      </button>

      {/* Stepper */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem" }}>
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            onClick={() => stepComplete(i) || i <= currentStep ? setCurrentStep(i) : null}
            style={{
              flex: 1,
              padding: "0.5rem 0.25rem",
              textAlign: "center",
              fontSize: "0.75rem",
              fontWeight: i === currentStep ? "bold" : "normal",
              color: stepComplete(i) ? "#4ade80" : i === currentStep ? "#fff" : "#666",
              borderBottom: `3px solid ${stepComplete(i) ? "#4ade80" : i === currentStep ? "#60a5fa" : "#333"}`,
              cursor: stepComplete(i) || i <= currentStep ? "pointer" : "default",
            }}
          >
            {stepComplete(i) ? "\u2713 " : ""}{s.label}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#3b1111", border: "1px solid #f87171", color: "#fca5a5", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Step 0: Hero Record */}
      {currentStep === 0 && (
        <DataCard title="Step 1: Hero Record">
          <p style={{ color: "#aaa", marginBottom: "1rem" }}>Create the Memorial Bracelet record in Salesforce.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Field label="First Name *" value={heroData.firstName} onChange={(v) => setHeroData({ ...heroData, firstName: v })} />
            <Field label="Last Name *" value={heroData.lastName} onChange={(v) => setHeroData({ ...heroData, lastName: v })} />
            <Field label="Middle Initial" value={heroData.middleInitial} onChange={(v) => setHeroData({ ...heroData, middleInitial: v })} />
            <Select label="Rank *" value={heroData.rank} onChange={(v) => setHeroData({ ...heroData, rank: v })} options={RANKS} />
            <Select label="Branch *" value={heroData.branch} onChange={(v) => setHeroData({ ...heroData, branch: v })} options={BRANCHES} />
            <Field label="Memorial Date *" value={heroData.memorialDate} onChange={(v) => setHeroData({ ...heroData, memorialDate: v })} type="date" />
          </div>
          {heroData.lastName && heroData.branch && (
            <p style={{ color: "#60a5fa", marginTop: "0.75rem", fontSize: "0.85rem" }}>
              SKU: {heroData.branch.includes("Army") ? "USA" : heroData.branch.includes("Marine") ? "USMC" : heroData.branch.includes("Navy") ? "USN" : heroData.branch.includes("Air") ? "USAF" : heroData.branch.includes("Coast") ? "USCG" : "USSF"}-{heroData.lastName.toUpperCase()}
            </p>
          )}
          <div style={{ marginTop: "1rem" }}>
            <button onClick={submitHero} disabled={saving || !heroData.firstName || !heroData.lastName || !heroData.rank || !heroData.branch || !heroData.memorialDate} className="btn-primary">
              {saving ? "Creating..." : "Create Hero Record"}
            </button>
          </div>
          {heroResult && <Success>Created: {heroResult.name} ({heroResult.sku})</Success>}
        </DataCard>
      )}

      {/* Step 1: Family Contact */}
      {currentStep === 1 && (
        <DataCard title="Step 2: Family Contact">
          <p style={{ color: "#aaa", marginBottom: "1rem" }}>Who reached out? Create or find their contact record.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Field label="First Name *" value={contactData.firstName} onChange={(v) => setContactData({ ...contactData, firstName: v })} />
            <Field label="Last Name *" value={contactData.lastName} onChange={(v) => setContactData({ ...contactData, lastName: v })} />
            <Field label="Email" value={contactData.email} onChange={(v) => setContactData({ ...contactData, email: v })} type="email" />
            <Field label="Phone" value={contactData.phone} onChange={(v) => setContactData({ ...contactData, phone: v })} />
            <Select label="Relationship" value={contactData.relationship} onChange={(v) => setContactData({ ...contactData, relationship: v })} options={RELATIONSHIPS} />
          </div>
          <div style={{ marginTop: "1rem", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#ccc" }}>Mailing Address</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Street Address" value={contactData.mailingStreet} onChange={(v) => setContactData({ ...contactData, mailingStreet: v })} placeholder="1 Lincoln Street Extension" />
            </div>
            <Field label="City" value={contactData.mailingCity} onChange={(v) => setContactData({ ...contactData, mailingCity: v })} />
            <Field label="State" value={contactData.mailingState} onChange={(v) => setContactData({ ...contactData, mailingState: v })} />
            <Field label="Zip" value={contactData.mailingPostalCode} onChange={(v) => setContactData({ ...contactData, mailingPostalCode: v })} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button onClick={submitContact} disabled={saving || !contactData.firstName || !contactData.lastName || (!contactData.email && !contactData.phone)} className="btn-primary">
              {saving ? "Linking..." : "Create & Link Contact"}
            </button>
          </div>
          {contactResult && <Success>Linked: {contactResult.contactName} {contactResult.wasExisting ? "(existing contact)" : "(new contact)"}</Success>}
        </DataCard>
      )}

      {/* Step 2: Charity */}
      {currentStep === 2 && (
        <DataCard title="Step 3: Charity Designation">
          <p style={{ color: "#aaa", marginBottom: "1rem" }}>Where does the $10/bracelet obligation go?</p>
          <Field label="Organization Name *" value={charityName} onChange={setCharityName} placeholder="e.g. MANS Legacy Foundation" />
          <div style={{ marginTop: "1rem" }}>
            <button onClick={submitCharity} disabled={saving || !charityName} className="btn-primary">
              {saving ? "Setting..." : "Set Charity Designation"}
            </button>
          </div>
          {charityResult && <Success>Charity set: {charityResult.orgName} {charityResult.wasExisting ? "(existing)" : "(new account)"}</Success>}
        </DataCard>
      )}

      {/* Step 3: Design Brief */}
      {currentStep === 3 && (
        <DataCard title="Step 4: Design Brief">
          <p style={{ color: "#aaa", marginBottom: "1rem" }}>What goes on the bracelet? Paste details from the family and upload reference images.</p>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", color: "#ccc", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Design Brief *</label>
            <textarea
              value={designBrief}
              onChange={(e) => setDesignBrief(e.target.value)}
              rows={6}
              style={{ width: "100%", background: "#1e1e2e", color: "#e0e0e0", border: "1px solid #444", borderRadius: "6px", padding: "0.5rem", fontFamily: "inherit", resize: "vertical" }}
              placeholder={"Front: EGA Left, MARSOC Right\nText: MAJOR MOISES \"MO\" NAVAS\n2ND MARINE RAIDER BATTALION\n16 DEC 1985 - 8 MAR 2020"}
            />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", color: "#ccc", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Reference Images</label>
            {/* Uploaded images */}
            {uploadedImages.length > 0 && (
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                {uploadedImages.map((img, i) => (
                  <div key={i} style={{ position: "relative", border: "1px solid #444", borderRadius: "6px", overflow: "hidden", width: 120 }}>
                    <img src={img.url} alt={img.filename} style={{ width: "100%", height: 80, objectFit: "cover" }} />
                    <div style={{ padding: "0.25rem 0.4rem", fontSize: "0.7rem", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {img.filename}
                    </div>
                    <button
                      onClick={() => setUploadedImages(uploadedImages.filter((_, j) => j !== i))}
                      style={{ position: "absolute", top: 2, right: 2, background: "#000c", border: "none", color: "#f87171", cursor: "pointer", borderRadius: "50%", width: 20, height: 20, fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Upload button */}
            <label style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              background: "#1e1e2e", border: "1px dashed #555", borderRadius: "6px",
              padding: "0.5rem 1rem", cursor: uploading ? "wait" : "pointer",
              color: uploading ? "#666" : "#60a5fa", fontSize: "0.85rem",
            }}>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                style={{ display: "none" }}
                onChange={async (e) => {
                  const files = Array.from(e.target.files);
                  if (!files.length) return;
                  setUploading(true);
                  try {
                    const results = await Promise.all(files.map(async (file) => {
                      const fd = new FormData();
                      fd.append("file", file);
                      fd.append("heroSku", heroResult?.sku || "unknown");
                      const res = await fetch("/api/families/intake/upload", { method: "POST", body: fd });
                      return res.json();
                    }));
                    const successful = results.filter((r) => r.success);
                    setUploadedImages((prev) => [...prev, ...successful]);
                  } catch (err) {
                    setError("Upload failed: " + err.message);
                  }
                  setUploading(false);
                  e.target.value = "";
                }}
              />
              {uploading ? "Uploading..." : `Upload Images (${uploadedImages.length} attached)`}
            </label>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button onClick={submitDesign} disabled={saving || !designBrief} className="btn-primary">
              {saving ? "Saving..." : "Save Design Brief"}
            </button>
          </div>
          {designResult && <Success>Design brief saved with {uploadedImages.length} image(s). Ryan will be notified.</Success>}
        </DataCard>
      )}

      {/* Step 4: Donated Order */}
      {currentStep === 4 && (
        <DataCard title="Step 5: Donated Order">
          <p style={{ color: "#aaa", marginBottom: "1rem" }}>Create the donated bracelet order. Separate line items are created for each size.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Field label='Regular (7")' value={orderData.quantity7} onChange={(v) => setOrderData({ ...orderData, quantity7: parseInt(v) || 0 })} type="number" />
            <Field label='Small (6")' value={orderData.quantity6} onChange={(v) => setOrderData({ ...orderData, quantity6: parseInt(v) || 0 })} type="number" />
          </div>

          <div style={{ marginTop: "1rem", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#ccc" }}>Shipping Address</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Field label="Ship To Name" value={orderData.shippingName} onChange={(v) => setOrderData({ ...orderData, shippingName: v })} placeholder={contactResult?.contactName || ""} />
            <Field label="Street Address *" value={orderData.shippingAddress1} onChange={(v) => setOrderData({ ...orderData, shippingAddress1: v })} />
            <Field label="City *" value={orderData.shippingCity} onChange={(v) => setOrderData({ ...orderData, shippingCity: v })} />
            <Field label="State *" value={orderData.shippingState} onChange={(v) => setOrderData({ ...orderData, shippingState: v })} />
            <Field label="Zip *" value={orderData.shippingPostal} onChange={(v) => setOrderData({ ...orderData, shippingPostal: v })} />
          </div>

          <Field label="Notes" value={orderData.notes} onChange={(v) => setOrderData({ ...orderData, notes: v })} placeholder="Any special instructions" />

          <div style={{ marginTop: "1rem" }}>
            <button onClick={submitOrder} disabled={saving || (orderData.quantity7 + orderData.quantity6 < 1) || !orderData.shippingAddress1 || !orderData.shippingCity || !orderData.shippingState || !orderData.shippingPostal} className="btn-primary">
              {saving ? "Creating..." : `Create Order (${(orderData.quantity7 || 0) + (orderData.quantity6 || 0)} bracelets)`}
            </button>
          </div>
          {orderResult && <Success>Order {orderResult.orderName} created [{orderResult.initialStatus}]</Success>}
        </DataCard>
      )}

      {/* Step 5: Summary */}
      {currentStep === 5 && (
        <DataCard title="Intake Complete">
          <div style={{ padding: "1rem 0" }}>
            <h3 style={{ color: "#4ade80", marginBottom: "1rem" }}>
              {heroResult?.name || "Hero"} is in the pipeline
            </h3>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <SummaryRow label="Hero Record" value={heroResult?.name} sub={`SKU: ${heroResult?.sku}`} />
              <SummaryRow label="Family Contact" value={contactResult?.contactName} sub={contactData.email} />
              <SummaryRow label="Charity" value={charityResult?.orgName} />
              <SummaryRow label="Design" value={designBrief?.slice(0, 60) + (designBrief?.length > 60 ? "..." : "")} />
              <SummaryRow label="Order" value={orderResult?.orderName} sub={orderResult?.initialStatus} />
            </div>
            <div style={{ marginTop: "1.5rem", color: "#aaa", fontSize: "0.85rem" }}>
              <strong>Next steps:</strong> Ryan will create the design, then it goes to laser production, then shipping.
            </div>
            <button onClick={() => { setMode("list"); window.location.reload(); }} className="btn-primary" style={{ marginTop: "1rem" }}>
              Done
            </button>
          </div>
        </DataCard>
      )}
    </div>
  );
}

// --- Helper components ---

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: "0.25rem" }}>
      <label style={{ display: "block", color: "#ccc", fontSize: "0.85rem", marginBottom: "0.25rem" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "#1e1e2e", color: "#e0e0e0", border: "1px solid #444", borderRadius: "6px", padding: "0.5rem", fontFamily: "inherit" }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: "0.25rem" }}>
      <label style={{ display: "block", color: "#ccc", fontSize: "0.85rem", marginBottom: "0.25rem" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", background: "#1e1e2e", color: "#e0e0e0", border: "1px solid #444", borderRadius: "6px", padding: "0.5rem", fontFamily: "inherit" }}
      >
        <option value="">Select...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Success({ children }) {
  return (
    <div style={{ background: "#0a2e1a", border: "1px solid #4ade80", color: "#86efac", padding: "0.5rem 0.75rem", borderRadius: "6px", marginTop: "0.75rem", fontSize: "0.85rem" }}>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #333" }}>
      <span style={{ color: "#999" }}>{label}</span>
      <span style={{ color: "#e0e0e0", textAlign: "right" }}>
        {value || "—"}
        {sub && <span style={{ display: "block", color: "#666", fontSize: "0.8rem" }}>{sub}</span>}
      </span>
    </div>
  );
}
