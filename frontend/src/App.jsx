import { useState, useEffect } from "react";
import Login from "./Login.jsx";
import Dashboard from "./dashboard.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Restore existing login session
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    const cors = require("cors");

    const allowedOrigins = [
      "http://localhost:5173",
      "https://YOUR-CLOUDFLARE-DOMAIN.pages.dev"
    ];

    app.use(cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }));
    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);

        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }

    setCheckingSession(false);


  }, []);

  // Called after successful OTP verification
  const handleLogin = (userData) => {
    setUser(userData);
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (checkingSession) {
    return <div>Checking login session...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (<Dashboard
    user={user}
    onLogout={handleLogout}
  />
  );
}

export default App;
