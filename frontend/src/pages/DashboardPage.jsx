import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api.js";
import "./Dashboard.css";

const money = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
export default function DashboardPage({ onNavigate }) {
    const [data, setData] = useState({
        sales: 0,
        customers: 0,
        active: 0,
        completed: 0,
        bills: []
    }); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    useEffect(() => {
        let live = true; (async () => {
            try {
                const paths = [
                    "/sh-bills/",
                    "/sh-bills/customers",
                    "/gi/customers?filter=active",
                    "/gi/customers?filter=completed"
                ]; const rs = await Promise.all(
                    paths.map(path => apiFetch(path))
                ); const js = await Promise.all(rs.map(r => r.json())); if (!rs.every(r => r.ok) || js.some(x => x.success === false)) throw Error("Dashboard information is temporarily unavailable."); if (!live) return; const bills = Array.isArray(js[0].data) ? js[0].data : Array.isArray(js[0].bills) ? js[0].bills : []; setData({ sales: bills.reduce((s, b) => s + Number(b.grand_total || b.total_amount || 0), 0), customers: Array.isArray(js[1].data) ? js[1].data.length : Array.isArray(js[1].customers) ? js[1].customers.length : 0, active: Array.isArray(js[2].data) ? js[2].data.length : Array.isArray(js[2].customers) ? js[2].customers.length : 0, completed: Array.isArray(js[3].data) ? js[3].data.length : Array.isArray(js[3].customers) ? js[3].customers.length : 0, bills: bills.slice(0, 5) });
            } catch (e) { if (live) setError(e.message); } finally { if (live) setLoading(false); }
        })(); return () => { live = false }
    }, []);
    const cards = [["Sales recorded", money(data.sales), "▤", "gold", "Across fetched bills"], ["SH customers", data.customers, "♙", "mint", "Registered customers"], ["Active Girvi", data.active, "◇", "peach", "Open accounts"], ["Completed GI", data.completed, "✓", "lavender", "Closed accounts"]];
    return <div className="dashboard-page"><div className="welcome-row"><div><span className="gi-eyebrow">PRANALI JEWELLERS</span><h2><em>Pranali Jewellers Dashboard </em></h2></div><button className="primary-action" onClick={() => onNavigate("New SH Bill")}>＋ <span>Create bill</span></button></div>
        <section className="metric-grid">{cards.map(([label, value, icon, color, note]) => <article className="metric-card" key={label}><div className={`metric-icon ${color}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{loading ? "—" : value}</strong><small>{note}</small></div></article>)}</section>
        {error && <div className="inline-alert">{error} <button onClick={() => location.reload()}>Retry</button></div>}
        <section className="module-launcher-section"><div className="section-head"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Shop modules</h2></div><span className="module-count">7 modules</span></div><div className="module-launcher-grid">{[["New SH Bill", "＋", "Create sales invoices", "gold"], ["SH Customers", "♙", "Manage sales customers", "mint"], ["New GI", "◇", "Register pledged jewellery", "peach"], ["GI Customers", "♧", "Manage active accounts", "lavender"], ["GI History", "◷", "Completed Girvi records", "gold"], ["GI Statistics", "▥", "Monthly investment insights", "mint"]].map(([name, icon, desc, tone]) => <button className="module-launcher-card" key={name} onClick={() => onNavigate(name)}><span className={`module-launcher-icon ${tone}`}>{icon}</span><span className="module-launcher-copy"><b>{name}</b><small>{desc}</small></span><i>↗</i></button>)}</div></section>
        <div className="dashboard-grid"><section className="surface-card recent-card"><div className="section-head"><div><span className="eyebrow">SALES MANAGEMENT</span><h2>Recent bills</h2></div><button className="text-action" onClick={() => onNavigate("New SH Bill")}>Create new ↗</button></div><div className="table-scroll"><table><thead><tr><th>Bill number</th><th>Customer</th><th>Amount</th><th>Date</th></tr></thead><tbody>{loading ? <tr><td colSpan="4">Loading bills…</td></tr> : data.bills.length ? data.bills.map((b, i) => <tr key={b.id || b.bill_number || i}><td className="strong-cell">{b.bill_number || b.invoice_no || `Bill ${i + 1}`}</td><td>{b.customer_name || b.customerName || "—"}</td><td>{money(b.grand_total || b.total_amount)}</td><td>{b.bill_date ? new Date(b.bill_date).toLocaleDateString("en-IN") : "—"}</td></tr>) : <tr><td colSpan="4">No recent bills available.</td></tr>}</tbody></table></div></section>
            <section className="surface-card quick-card"><div className="section-head"><div><span className="eyebrow">QUICK ACTIONS</span><h2>What would you like to do?</h2></div></div><div className="quick-actions"><button onClick={() => onNavigate("New SH Bill")}><span className="quick-icon gold">＋</span><span><b>New sales bill</b><small>Create a jewellery invoice</small></span><i>›</i></button><button onClick={() => onNavigate("New GI")}><span className="quick-icon mint">◇</span><span><b>New Girvi account</b><small>Record pledged jewellery</small></span><i>›</i></button><button onClick={() => onNavigate("SH Customers")}><span className="quick-icon lavender">♙</span><span><b>Find a customer</b><small>Search customer records</small></span><i>›</i></button><button onClick={() => onNavigate("GI Statistics")}><span className="quick-icon peach">▥</span><span><b>View GI statistics</b><small>Review Girvi performance</small></span><i>›</i></button></div></section>

        </div></div>;
}
