const items = [
  ["Overview", "⌂", "Home"],
  ["New SH Bill", "＋", "SH Bill"],
  ["SH Customers", "♙", "Customers"],
  ["New GI", "◇", "New GI"],
  ["More", "•••", "More"],
];
export default function MobileNav({ active, onNavigate }) {
  const selected = ["GI Customers", "GI History", "GI Statistics", "More"].includes(active) ? "More" : active;
  return <nav className="mobile-nav" aria-label="Mobile navigation">
    {items.map(([name, icon, label]) => <button key={name} className={selected === name ? "selected" : ""} onClick={() => onNavigate(name)} aria-current={selected === name ? "page" : undefined}>
      <span>{icon}</span><small>{label}</small>
    </button>)}
  </nav>;
}
