const modules = [
  { name: "GI Customers", icon: "♧", desc: "Manage active Girvi accounts", tone: "mint" },
  { name: "GI History", icon: "◷", desc: "View completed Girvi records", tone: "gold" },
  { name: "GI Statistics", icon: "▥", desc: "Review monthly investments", tone: "lavender" },
  { name: "DailyAccounts", icon: "✎", desc: "Manage daily transactions", tone: "sky" },
];
export default function MorePage({ onNavigate, onLogout, user }) {
  return <section className="more-page">
    <div className="more-welcome"><span className="eyebrow">PRANALI JEWELLERS</span><h1>More workspace tools</h1><p>Everything else you need to manage your shop.</p></div>
    <div className="more-module-grid">{modules.map((m) => <button className="more-module-card" key={m.name} onClick={() => onNavigate(m.name)}>
      <span className={`more-module-icon ${m.tone}`}>{m.icon}</span><span className="more-module-copy"><strong>{m.name}</strong><small>{m.desc}</small></span><i>›</i>
    </button>)}</div>
    <section className="account-settings-card"><div className="account-settings-avatar">{(user?.name || user?.email || "P").slice(0,1).toUpperCase()}</div><div><strong>{user?.name || "Shop account"}</strong><small>{user?.email || "Signed in to Pranali Jewellers"}</small></div><button onClick={onLogout}>Sign out ↗</button></section>
  </section>;
}
