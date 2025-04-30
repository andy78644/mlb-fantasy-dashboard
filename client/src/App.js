import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate
} from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeaguePage from './pages/LeaguePage';
import AuthProvider, { useAuth } from './context/AuthContext'; // Auth context
import './App.css';

// A wrapper for routes that require authentication
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading authentication status...</div>; // Or a spinner
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <ModernNav /> 
          <div className="content-container">
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <DashboardPage />
                  </PrivateRoute>
                }
              />
              <Route 
                path="/league/:leagueId" 
                element={
                  <PrivateRoute>
                    <LeaguePage />
                  </PrivateRoute>
                }
              />

              {/* Default route - redirect based on auth status */}
              <Route 
                path="/" 
                element={
                  <AuthRedirector />
                }
              />

              {/* Catch-all redirects to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Modern Navigation Component
function ModernNav() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="modern-nav">
      <div className="nav-content">
        <div className="nav-logo-section">
          <img 
            src="https://images.seeklogo.com/logo-png/25/1/mlb-logo-png_seeklogo-250501.png" 
            alt="MLB Logo" 
            className="nav-logo" 
          />
          <h1 className="nav-title">Fantasy Baseball Dashboard</h1>
        </div>

        <ul className="nav-links">
          {isAuthenticated && (
            <>
              <li><Link to="/dashboard" className="nav-link">Dashboard</Link></li>
              <li><Link to="/" className="nav-link">My Leagues</Link></li>
              <li><button onClick={logout} className="nav-logout-button">Logout</button></li>
            </>
          )}
          {!isAuthenticated && (
            <li><Link to="/login" className="nav-link">Login</Link></li>
          )}
        </ul>
      </div>
    </nav>
  );
}

// Helper component to redirect based on auth status
function AuthRedirector() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default App;
