import { useState } from 'react';
import Login from './pages/Login';
import Layout from './components/layout';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const handleLogin = (authenticatedSession) => {
    setSession(authenticatedSession);
    setShowWelcome(true);
    window.setTimeout(() => setShowWelcome(false), 3000);
  };

  return (
    <>
      {session
        ? <Layout user={session.user} token={session.token} onLogout={() => setSession(null)} />
        : <Login onLogin={handleLogin} />}
      {showWelcome && <div className="welcome-toast" role="status">Login successfully! Welcome to Bili-Bili</div>}
    </>
  );
}

export default App;