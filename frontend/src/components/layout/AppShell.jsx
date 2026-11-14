import { useState } from "react";
import Topbar from "./Topbar.jsx";
import MobileNav from "./MobileNav.jsx";
import DashboardPage from "../../pages/DashboardPage.jsx";
import MorePage from "../../pages/MorePage.jsx";
import NewSHBill from "../../modules/NewSHBill.jsx";
import SHCustomers from "../../modules/SHCustomers.jsx";
import NewGIBill from "../../modules/NewGi.jsx";
import GICustomer from "../../modules/GICustomer.jsx";
import GIHistory from "../../modules/GIHistory.jsx";
import GIStatistics from "../../modules/GIStatistics.jsx";

const pageTitles = {
  Overview: "Dashboard",
  "New SH Bill": "Create sales bill",
  "SH Customers": "Sales customers",
  "New GI": "New Girvi account",
  "GI Customers": "Active Girvi accounts",
  "GI History": "Girvi history",
  "GI Statistics": "Girvi statistics",
  More: "More modules",
};

export default function AppShell({ user, onLogout }) {
  const [active, setActive] = useState("Overview");
  const navigate = (name) => {
    setActive(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const content = {
    Overview: <DashboardPage onNavigate={navigate} />,
    "New SH Bill": <NewSHBill onNavigate={navigate} />,
    "SH Customers": <SHCustomers />,
    "New GI": <NewGIBill />,
    "GI Customers": <GICustomer />,
    "GI History": <GIHistory />,
    "GI Statistics": <GIStatistics />,
    More: <MorePage onNavigate={navigate} onLogout={onLogout} user={user} />,
  }[active];

  return (
    <div className="app-frame app-frame-no-sidebar">
      <div className="app-main app-main-no-sidebar">
        <Topbar user={user} title={pageTitles[active] || active} onLogout={onLogout} />
        <nav className="desktop-module-nav" aria-label="Main navigation">
          {[
            ["Overview", "⌂"], ["New SH Bill", "＋"], ["SH Customers", "♙"],
            ["New GI", "◇"], ["GI Customers", "♧"], ["GI History", "◷"],
            ["GI Statistics", "▥"],
          ].map(([name, icon]) => (
            <button key={name} className={active === name ? "desktop-nav-item active" : "desktop-nav-item"} onClick={() => navigate(name)}>
              <span>{icon}</span>{name}
            </button>
          ))}
        </nav>
        <main className={`page-stage ${active === "Overview" ? "overview-stage" : "module-stage"}`}>
        
          <div className="module-host">{content}</div>
        </main>
        <MobileNav active={active} onNavigate={navigate} />
      </div>
    </div>
  );
}
