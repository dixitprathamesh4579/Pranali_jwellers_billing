/*import { useState } from "react";
import Login from "./Login.jsx";
import Dashboard from "./dashboard.jsx";

function App() {
const [user, setUser] = useState(null);

if (!user) {
//return <Login onLogin={setUser} />;
return <Dashboard user={user} />;
}

return <Dashboard user={user} />;
}

export default App;*/


import { useState } from "react";
import Login from "./Login.jsx";
import Dashboard from "./Dashboard.jsx";

function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
    />
  );
}

export default App;

