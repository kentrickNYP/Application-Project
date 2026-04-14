import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import emailjs from "@emailjs/browser";

// ─── PASTE YOUR GOOGLE APPS SCRIPT URL HERE AFTER STEP 14 ───────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbxl1ywmq4pZf5gOjiN0CokZxPSfFDaajdHzs5fFKEynjEz6l7O7M0u066APNv0rU96V/exec";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CLASSES = [
  "DE26A4","DE26B4","DE26C4",
  "ET26A5","ET26B5","ET26C5","ET26D5",
  "ET26E5","ET26F5","ET26G5","ET26H5"
];
const SUBGROUPS = ["SG1","SG2","SG3","SG4","SG5"];
const BUDGET_CAP = 50;

const ITEMS = [
  // 1. Structure & Build
  { id:1,  name:"Corrugated Cardboard Sheet (A2)", category:"Structure & Build",  price:2.50,  emoji:"📦" },
  { id:2,  name:"Foam Board 5mm (A2)",              category:"Structure & Build",  price:4.00,  emoji:"🟦" },
  { id:3,  name:"Foam Board 10mm (A2)",             category:"Structure & Build",  price:6.50,  emoji:"🟪" },
  { id:4,  name:"Mount Board (A3)",                 category:"Structure & Build",  price:3.00,  emoji:"🗂️" },
  { id:5,  name:"Thick Paper (A3)",                 category:"Structure & Build",  price:1.50,  emoji:"📄" },
  { id:6,  name:"Ice Cream Sticks (1 pack)",        category:"Structure & Build",  price:3.50,  emoji:"🍦" },
  { id:7,  name:"Acrylic Sheet (A2)",               category:"Structure & Build",  price:12.00, emoji:"🔲" },

  // 2. Adhesives & Fastening
  { id:8,  name:"Double-Sided Tape",                category:"Adhesives & Fastening", price:3.00,  emoji:"📎" },
  { id:9,  name:"Velcro Strips (30cm)",             category:"Adhesives & Fastening", price:4.00,  emoji:"🔗" },
  { id:10, name:"Clear Tape",                       category:"Adhesives & Fastening", price:1.50,  emoji:"🩹" },
  { id:11, name:"White Glue / PVA (bottle)",        category:"Adhesives & Fastening", price:4.50,  emoji:"🧴" },

  // 3. Visualisation & Marking
  { id:12, name:"Permanent Markers (black + colours)", category:"Visualisation & Marking", price:6.50,  emoji:"🖊️" },
  { id:13, name:"Pencils (pack)",                   category:"Visualisation & Marking", price:2.50,  emoji:"✏️" },
  { id:14, name:"Coloured Paper A4 (1 pack)",       category:"Visualisation & Marking", price:5.00,  emoji:"🎨" },
  { id:15, name:"Coloured Paper A3 (1 pack)",       category:"Visualisation & Marking", price:7.00,  emoji:"🖼️" },
  { id:16, name:"Sticky Notes (1 pack)",            category:"Visualisation & Marking", price:3.50,  emoji:"📌" },

  // 4. Basic Assembly / Hardware
  { id:17, name:"Binder Clips (1 pair)",            category:"Basic Assembly & Hardware", price:1.00,  emoji:"🖇️" },
  { id:18, name:"Rubber Bands (1 pack)",            category:"Basic Assembly & Hardware", price:1.50,  emoji:"🔴" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toFixed(2)}`;

async function getSpend(cls, sg) {
  try {
    const res  = await fetch(`${API_URL}?action=getSpend&cls=${encodeURIComponent(cls)}&sg=${encodeURIComponent(sg)}`);
    const data = await res.json();
    return parseFloat(data.spend) || 0;
  } catch { return 0; }
}

async function setSpend(cls, sg, amount) {
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "setSpend", cls, sg, amount }),
    });
  } catch(e) { console.error("setSpend error:", e); }
}

async function appendOrderLog(entry) {
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "appendLog", order: entry }),
    });
  } catch(e) { console.error("appendLog error:", e); }
}

async function getAllOrders() {
  try {
    const res  = await fetch(`${API_URL}?action=getLogs`);
    const data = await res.json();
    return data.logs || [];
  } catch { return []; }
}

// ── Fill in your three EmailJS IDs here ──────────────────────────────────────
const EMAILJS_SERVICE_ID  = "service_d2lfqtq";  // from Step 2
const EMAILJS_TEMPLATE_ID = "template_ayrpabb";  // from Step 3
const EMAILJS_PUBLIC_KEY  = "1EVL4Yutu77a8yr2y";   // from Step 4

async function sendEmail(orderData) {
  const { classGroup, subgroup, items, total, cumulativeSpend, timestamp } = orderData;

  const itemLines = items
    .map(i => `• ${i.name} x${i.qty} @ $${i.price.toFixed(2)} = $${(i.price * i.qty).toFixed(2)}`)
    .join("\n");

  const remaining = Math.max(BUDGET_CAP - cumulativeSpend, 0);

  const templateParams = {
    class_group: classGroup,
    subgroup:    subgroup,
    timestamp:   timestamp,
    items:       itemLines,
    total:       `$${total.toFixed(2)}`,
    cumulative:  `$${cumulativeSpend.toFixed(2)}`,
    remaining:   `$${remaining.toFixed(2)}`,
  };

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );
    console.log("Email sent successfully.");
  } catch (err) {
    console.error("Email failed:", err);
  }
}

function downloadExcel(orders) {
  const rows = [];
  orders.forEach(order => {
    // orders from Google Sheets come as arrays: [timestamp, class, sg, item, qty, price, lineTotal, orderTotal, cumulative]
    const isArray = Array.isArray(order);
    if (isArray) {
      rows.push({
        "Timestamp":            order[0],
        "Class":                order[1],
        "Subgroup":             order[2],
        "Item":                 order[3],
        "Qty":                  order[4],
        "Unit Price ($)":       order[5],
        "Line Total ($)":       order[6],
        "Order Total ($)":      order[7],
        "Cumulative Spend ($)": order[8],
        "Budget Cap ($)":       BUDGET_CAP,
        "Remaining ($)":        parseFloat((BUDGET_CAP - order[8]).toFixed(2)),
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    {wch:22},{wch:10},{wch:10},{wch:32},{wch:6},
    {wch:14},{wch:14},{wch:14},{wch:18},{wch:14},{wch:14}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All Orders");
  XLSX.writeFile(wb, `NYP_Makerspace_Orders_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─── ORDER PAGE ───────────────────────────────────────────────────────────────
function OrderPage({ onCheckout }) {
  const [classGroup,    setClassGroup]    = useState("");
  const [subgroup,      setSubgroup]      = useState("");
  const [cart,          setCart]          = useState({});
  const [selectedItem,  setSelectedItem]  = useState("");
  const [qty,           setQty]           = useState(1);
  const [error,         setError]         = useState("");
  const [pastSpend,     setPastSpend]     = useState(0);
  const [loadingSpend,  setLoadingSpend]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [shake,         setShake]         = useState(false);

  useEffect(() => {
    if (!classGroup || !subgroup) { setPastSpend(0); return; }
    setLoadingSpend(true);
    getSpend(classGroup, subgroup).then(s => { setPastSpend(s); setLoadingSpend(false); });
  }, [classGroup, subgroup]);

  const cartTotal  = Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
  const totalSpend = pastSpend + cartTotal;
  const remaining  = BUDGET_CAP - totalSpend;
  const budgetPct  = Math.min((totalSpend / BUDGET_CAP) * 100, 100);
  const budgetColor = budgetPct > 85 ? "#ef4444" : budgetPct > 60 ? "#f59e0b" : "#22c55e";

  const addToCart = () => {
    if (!selectedItem) return;
    const item       = ITEMS.find(i => i.id === parseInt(selectedItem));
    const currentQty = cart[item.id]?.qty || 0;
    if (totalSpend + item.price * qty > BUDGET_CAP) {
      setError(`Over budget! Only ${fmt(remaining)} remaining (including past orders).`);
      setShake(true); setTimeout(() => setShake(false), 500);
      return;
    }
    setError("");
    setCart(prev => ({ ...prev, [item.id]: { ...item, qty: currentQty + qty } }));
    setSelectedItem(""); setQty(1);
  };

  const removeItem = (id) => setCart(prev => { const u = {...prev}; delete u[id]; return u; });

  const handleCheckout = async () => {
    if (!classGroup || !subgroup) { setError("Please select your class and subgroup."); return; }
    if (Object.keys(cart).length === 0) { setError("Your cart is empty!"); return; }
    setSubmitting(true);
    const ts            = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
    const newCumulative = pastSpend + cartTotal;
    const orderData     = { classGroup, subgroup, items: Object.values(cart), total: cartTotal, cumulativeSpend: newCumulative, timestamp: ts };
    await setSpend(classGroup, subgroup, newCumulative);
    await appendOrderLog(orderData);
    await sendEmail(orderData);
    setSubmitting(false);
    onCheckout(orderData);
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.hInner}>
          <span style={S.hIcon}>🛒</span>
          <div>
            <h1 style={S.hTitle}>Group Order</h1>
            <p style={S.hSub}>NYP · Makerspace Supplies · Budget: {fmt(BUDGET_CAP)}/group</p>
          </div>
        </div>
      </div>

      <div style={S.content}>
        {/* Group Selection */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>📍 Your Group</h2>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Class</label>
              <select style={S.sel} value={classGroup} onChange={e => { setClassGroup(e.target.value); setCart({}); }}>
                <option value="">Select class…</option>
                {CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Subgroup</label>
              <select style={S.sel} value={subgroup} onChange={e => { setSubgroup(e.target.value); setCart({}); }}>
                <option value="">Select subgroup…</option>
                {SUBGROUPS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {classGroup && subgroup && (
            <div style={S.pastBox}>
              {loadingSpend ? (
                <span style={S.pastText}>⏳ Checking past orders from Google Sheets…</span>
              ) : pastSpend > 0 ? (
                <span style={S.pastText}>
                  📊 <strong>{classGroup} {subgroup}</strong> has previously spent{" "}
                  <strong style={{ color: budgetColor }}>{fmt(pastSpend)}</strong> —{" "}
                  <strong>{fmt(BUDGET_CAP - pastSpend)}</strong> remaining.
                </span>
              ) : (
                <span style={{ ...S.pastText, color: "#22c55e" }}>
                  ✅ <strong>{classGroup} {subgroup}</strong> has no previous orders. Full {fmt(BUDGET_CAP)} available.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Add Items */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>📦 Add Items</h2>
          <div style={S.row}>
            <div style={{ ...S.field, flex: 2 }}>
              <label style={S.label}>Item</label>
              <select style={S.sel} value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                <option value="">Choose an item…</option>
                {ITEMS.map(i => <option key={i.id} value={i.id}>{i.emoji} {i.name} — {fmt(i.price)}</option>)}
              </select>
            </div>
            <div style={{ ...S.field, flex: 0.5 }}>
              <label style={S.label}>Qty</label>
              <input type="number" min="1" max="10" value={qty}
                onChange={e => setQty(parseInt(e.target.value) || 1)} style={S.numInput} />
            </div>
            <div style={{ ...S.field, flex: 0.7 }}>
              <label style={S.label}>&nbsp;</label>
              <button style={S.addBtn} onClick={addToCart}>+ Add</button>
            </div>
          </div>
        </div>

        {/* Budget Bar */}
        <div style={S.budgetCard}>
          <div style={S.budgetRow}>
            <span style={S.budgetLbl}>Total Budget Used</span>
            <span style={{ ...S.budgetAmt, color: budgetColor }}>{fmt(totalSpend)} / {fmt(BUDGET_CAP)}</span>
          </div>
          <div style={S.bar}><div style={{ ...S.barFill, width: `${budgetPct}%`, background: budgetColor }} /></div>
          <div style={S.budgetDetail}>
            {pastSpend > 0 && <span style={S.budgetSplit}>Past: {fmt(pastSpend)} + This order: {fmt(cartTotal)}</span>}
            <span style={{ ...S.budgetRem, color: budgetColor, marginLeft: "auto" }}>
              {remaining >= 0 ? `${fmt(remaining)} remaining` : "⚠️ Over budget"}
            </span>
          </div>
        </div>

        {/* Cart */}
        {Object.keys(cart).length > 0 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>🧾 Current Cart</h2>
            {Object.values(cart).map(item => (
              <div key={item.id} style={S.cartRow}>
                <span style={{ fontSize: 18 }}>{item.emoji}</span>
                <div style={S.cartInfo}>
                  <span style={S.cartName}>{item.name}</span>
                  <span style={S.cartMeta}>×{item.qty} @ {fmt(item.price)}</span>
                </div>
                <span style={S.cartAmt}>{fmt(item.price * item.qty)}</span>
                <button style={S.rmBtn} onClick={() => removeItem(item.id)}>✕</button>
              </div>
            ))}
            <div style={S.cartFoot}>
              <span>Order Total</span>
              <span style={S.cartFootAmt}>{fmt(cartTotal)}</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ ...S.errBox, animation: shake ? "shake 0.4s" : "none" }}>⚠️ {error}</div>
        )}

        <button style={{ ...S.checkBtn, opacity: submitting ? 0.7 : 1 }} onClick={handleCheckout} disabled={submitting}>
          {submitting ? "⏳ Submitting…" : "Checkout & Notify Lecturer →"}
        </button>
        <p style={S.checkNote}>Order will be saved after clicking check out · Email will be sent to lecturer</p>
      </div>

      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        select:focus,input:focus{outline:2px solid #6366f1;outline-offset:2px;}
        button{transition:all 0.15s ease;}
        button:not(:disabled):hover{opacity:0.88;transform:translateY(-1px);}
      `}</style>
    </div>
  );
}

// ─── BOUGHT PAGE ──────────────────────────────────────────────────────────────
function BoughtPage({ order, onBack }) {
  const remaining = BUDGET_CAP - order.cumulativeSpend;

  return (
    <div style={S.page}>
      <div style={{ ...S.header, background: "linear-gradient(135deg,#14532d,#166534)" }}>
        <div style={S.hInner}>
          <span style={S.hIcon}>✅</span>
          <div>
            <h1 style={S.hTitle}>Order Confirmed</h1>
            <p style={S.hSub}>Saved to Google Sheets · Email sent</p>
          </div>
        </div>
      </div>

      <div style={S.content}>
        <div style={{ ...S.card, border: "2px dashed #d1d5db", background: "#fafafa" }}>
          <div style={S.rcptHead}>
            <div style={{ fontSize: 36 }}>🛒</div>
            <h2 style={S.rcptTitle}>NYP Makerspace</h2>
            <p style={S.rcptSub}>Group Order Receipt</p>
            <p style={S.rcptDate}>{order.timestamp}</p>
          </div>

          <div style={S.div} />

          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:4 }}>
            <div style={S.mRow}><span style={S.mKey}>Class</span><span style={S.mVal}>{order.classGroup}</span></div>
            <div style={S.mRow}><span style={S.mKey}>Subgroup</span><span style={S.mVal}>{order.subgroup}</span></div>
          </div>

          <div style={S.div} />

          {order.items.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:18 }}>{item.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{item.name}</div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>×{item.qty} @ {fmt(item.price)}</div>
              </div>
              <span style={{ fontWeight:700, color:"#4f46e5" }}>{fmt(item.price * item.qty)}</span>
            </div>
          ))}

          <div style={S.div} />

          <div style={S.rcptTotals}>
            <div style={S.rcptTRow}><span>This Order</span><span style={{ fontWeight:700 }}>{fmt(order.total)}</span></div>
            <div style={S.rcptTRow}><span>All-time Spend</span><span style={{ fontWeight:700, color:"#dc2626" }}>{fmt(order.cumulativeSpend)}</span></div>
            <div style={{ ...S.rcptTRow, borderTop:"1px dashed #e2e8f0", paddingTop:10, marginTop:4 }}>
              <span style={{ fontWeight:700 }}>Remaining Budget</span>
              <span style={{ fontWeight:800, fontSize:18, color: remaining <= 0 ? "#dc2626" : "#14532d" }}>
                {fmt(Math.max(remaining, 0))}
              </span>
            </div>
          </div>

          <div style={S.rcptFooter}>
            <p>☁️ Order saved</p>
            <p>📧 Email sent to Lecturer for Processing</p>
            <p>Items will be prepared and passed to you physically.</p>
          </div>
        </div>

        <button style={{ ...S.checkBtn, background:"linear-gradient(135deg,#4f46e5,#7c3aed)" }} onClick={onBack}>
          ← Place Another Order
        </button>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,      setPage]      = useState("order");
  const [lastOrder, setLastOrder] = useState(null);

  return page === "order"
    ? <OrderPage onCheckout={order => { setLastOrder(order); setPage("bought"); }} />
    : <BoughtPage order={lastOrder} onBack={() => setPage("order")} />;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page:       { fontFamily:"'Sora','Segoe UI',sans-serif", minHeight:"100vh", background:"#f1f5f9", color:"#1e293b" },
  header:     { background:"linear-gradient(135deg,#312e81,#4f46e5)", padding:"22px 28px", color:"white", boxShadow:"0 4px 20px rgba(79,70,229,0.3)" },
  hInner:     { display:"flex", alignItems:"center", gap:14, maxWidth:700, margin:"0 auto" },
  hIcon:      { fontSize:38, lineHeight:1 },
  hTitle:     { margin:0, fontSize:24, fontWeight:800, letterSpacing:"-0.5px" },
  hSub:       { margin:"2px 0 0", fontSize:12, opacity:0.8 },
  content:    { maxWidth:700, margin:"0 auto", padding:"22px 16px 60px" },
  card:       { background:"white", borderRadius:16, padding:22, marginBottom:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0" },
  cardTitle:  { margin:"0 0 14px", fontSize:14, fontWeight:700, color:"#374151", letterSpacing:"0.2px" },
  row:        { display:"flex", gap:10, flexWrap:"wrap" },
  field:      { display:"flex", flexDirection:"column", flex:1, minWidth:110 },
  label:      { fontSize:11, fontWeight:700, color:"#6b7280", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" },
  sel:        { padding:"9px 11px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:14, color:"#1e293b", background:"white", cursor:"pointer" },
  numInput:   { padding:"9px 11px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:14, width:"100%", boxSizing:"border-box" },
  addBtn:     { padding:"9px 16px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"white", fontWeight:700, fontSize:13, cursor:"pointer" },
  pastBox:    { marginTop:12, padding:"10px 14px", borderRadius:10, background:"#f8fafc", border:"1px solid #e2e8f0", fontSize:13 },
  pastText:   { color:"#374151", lineHeight:1.5 },
  budgetCard: { background:"white", borderRadius:16, padding:"14px 22px", marginBottom:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0" },
  budgetRow:  { display:"flex", justifyContent:"space-between", marginBottom:8 },
  budgetLbl:  { fontSize:12, fontWeight:700, color:"#6b7280" },
  budgetAmt:  { fontSize:15, fontWeight:800 },
  bar:        { height:8, background:"#f1f5f9", borderRadius:99, overflow:"hidden" },
  barFill:    { height:"100%", borderRadius:99, transition:"width 0.4s ease,background 0.3s ease" },
  budgetDetail:{ display:"flex", alignItems:"center", marginTop:6 },
  budgetSplit: { fontSize:11, color:"#94a3b8" },
  budgetRem:   { fontSize:12, fontWeight:700 },
  cartRow:    { display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0", marginBottom:8 },
  cartInfo:   { flex:1, display:"flex", flexDirection:"column" },
  cartName:   { fontSize:13, fontWeight:600 },
  cartMeta:   { fontSize:11, color:"#94a3b8", marginTop:1 },
  cartAmt:    { fontSize:13, fontWeight:700, color:"#4f46e5" },
  rmBtn:      { background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:13, padding:"3px 5px" },
  cartFoot:   { display:"flex", justifyContent:"space-between", padding:"10px 12px 0", borderTop:"1px dashed #e2e8f0", fontWeight:700, fontSize:14 },
  cartFootAmt:{ fontSize:17, fontWeight:800, color:"#4f46e5" },
  errBox:     { background:"#fff1f2", border:"1px solid #fecaca", borderRadius:10, padding:"11px 14px", color:"#dc2626", fontSize:13, fontWeight:500, marginBottom:10 },
  checkBtn:   { width:"100%", padding:"15px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#14532d,#166534)", color:"white", fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:"0 4px 14px rgba(22,101,52,0.3)", marginBottom:0, display:"block" },
  checkNote:  { textAlign:"center", fontSize:11, color:"#94a3b8", marginTop:8, marginBottom:14 },
  rcptHead:   { textAlign:"center", paddingBottom:14 },
  rcptTitle:  { margin:"6px 0 2px", fontSize:18, fontWeight:800 },
  rcptSub:    { margin:0, color:"#6b7280", fontSize:12 },
  rcptDate:   { margin:"4px 0 0", fontSize:11, color:"#94a3b8" },
  div:        { border:"none", borderTop:"1px dashed #d1d5db", margin:"14px 0" },
  mRow:       { display:"flex", justifyContent:"space-between" },
  mKey:       { fontSize:12, color:"#6b7280" },
  mVal:       { fontSize:12, fontWeight:700 },
  rcptTotals: { background:"#f8fafc", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 },
  rcptTRow:   { display:"flex", justifyContent:"space-between", fontSize:14 },
  rcptFooter: { marginTop:16, textAlign:"center", fontSize:11, color:"#6b7280", lineHeight:1.8, background:"#f0fdf4", padding:"10px 14px", borderRadius:10 },
};
