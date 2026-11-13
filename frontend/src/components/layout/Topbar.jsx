export default function Topbar({ user, title, onLogout }) {
  const name = user?.name || user?.email?.split("@")[0] || "Shop Admin";
  return (
    <header className="topbar topbar-clean">
      <div className="topbar-brand-mark"><span>✧</span><div><strong>PRANALI</strong><small>JEWELLERS</small></div></div>
      <div className="topbar-context"><span>SHOP MANAGEMENT</span><strong>{title}</strong></div>
      <div className="topbar-actions">
        <div className="secure-pill"><span /> Secure workspace</div>
        <button className="profile-button" onClick={onLogout} title="Sign out">
          <span className="avatar">{String(name).slice(0, 1).toUpperCase()}</span>
          <span className="profile-name">{name}</span><span className="profile-chevron">↗</span>
        </button>
      </div>
    </header>
  );
}
