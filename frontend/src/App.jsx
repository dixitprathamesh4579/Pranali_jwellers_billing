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

return ( <Dashboard
   user={user}
   onLogout={handleLogout}
 />
);
}

export default App;
