import { useState, useEffect } from "react";
import Login from "./Login.jsx";
import Dashboard from "./dashboard.jsx";

// Decode JWT payload
function decodeToken(token) {
  try {
    const payload = token.split(".")[1];

    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

    return JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split("")
          .map((char) =>
            "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2)
          )
          .join("")
      )
    );
  } catch (error) {
    return null;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Clear login session
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setToken(null);
  };

  // Restore existing login session
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        const decoded = decodeToken(savedToken);

        // Token must contain a valid expiration time
        if (!decoded || !decoded.exp) {
          handleLogout();
        } else if (Date.now() >= decoded.exp * 1000) {
          // Token has expired
          handleLogout();
        } else {
          setUser(parsedUser);
          setToken(savedToken);
        }
      } catch (error) {
        handleLogout();
      }
    } else {
      handleLogout();
    }

    setCheckingSession(false);
  }, []);

  // Automatically logout when JWT expires
  useEffect(() => {
    if (!token || !user) return;

    const checkExpiration = () => {
      const decoded = decodeToken(token);

      if (!decoded || !decoded.exp) {
        handleLogout();
        return;
      }

      const expiryTime = decoded.exp * 1000;
      const remainingTime = expiryTime - Date.now();

      if (remainingTime <= 0) {
        handleLogout();
      }

      return remainingTime;
    };

    const remainingTime = checkExpiration();

    if (!remainingTime || remainingTime <= 0) return;

    const timer = setTimeout(() => {
      handleLogout();
    }, remainingTime);

    // Recheck when the user returns to the browser tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkExpiration();
      }
    };

    window.addEventListener("focus", checkExpiration);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Synchronize logout across browser tabs
    const handleStorageChange = (event) => {
      if (event.key === "token" && !event.newValue) {
        handleLogout();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", checkExpiration);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [token, user]);

  // Called after successful OTP verification
  const handleLogin = (userData) => {
    const savedToken = localStorage.getItem("token");

    if (!savedToken) {
      handleLogout();
      return;
    }

    const decoded = decodeToken(savedToken);

    if (!decoded || !decoded.exp || Date.now() >= decoded.exp * 1000) {
      handleLogout();
      return;
    }

    setUser(userData);
    setToken(savedToken);
  };

  if (checkingSession) {
    return <div>Checking login session...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
    />
  );
}

export default App;