import { useEffect, useState } from "react";
import Login from "../modules/Login.jsx";
import AppShell from "../components/layout/AppShell.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("user");
    if (token && saved) { try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem("token"); localStorage.removeItem("user"); } }
    setChecking(false);
  }, []);
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); };
  if (checking) return <div className="boot-screen"><div className="boot-mark">P</div><span>Preparing your workspace…</span></div>;
  return user ? <AppShell user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
