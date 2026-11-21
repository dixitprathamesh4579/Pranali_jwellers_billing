import { useEffect, useState } from "react";
import Login from "../modules/Login.jsx";
import AppShell from "../components/layout/AppShell.jsx";

const API_URL =
  `${import.meta.env.VITE_API_BASE_URL || "https://pranali-jwellers-billing.onrender.com"}/api`;

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (active) {
          setUser(null);
          setChecking(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.authenticated || !data.user) {
          throw new Error("Invalid session");
        }

        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

        if (active) {
          setUser(data.user);
        }

      } catch (error) {
        console.error("Session verification failed:", error);

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (checking) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">P</div>
        <span>Preparing your workspace…</span>
      </div>
    );
  }

  return user ? (
    <AppShell
      user={user}
      onLogout={handleLogout}
    />
  ) : (
    <Login onLogin={handleLogin} />
  );
}