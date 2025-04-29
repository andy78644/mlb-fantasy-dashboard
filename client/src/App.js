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
import CallbackHandler from './components/CallbackHandler'; // Handles the OAuth callback
import AuthProvider, { useAuth } from './context/AuthContext'; // Auth context
import './App.css';

// A wrapper for routes that require authentication
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading authentication status...</div>; // Or a spinner
  }

  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <nav>
            <ul>
              <li><Link to="/">Home</Link></li>
              {/* Add other nav links as needed */}
            </ul>
          </nav>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Route to handle the OAuth callback */}
            <Route path="/auth/callback" element={<CallbackHandler />} />

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

            {/* Default route - redirect to dashboard if logged in, else to login */}
            <Route 
              path="/" 
              element={
                <AuthRedirector />
              }
            />

            {/* Add other routes here */}
            <Route path="*" element={<Navigate to="/" replace />} />{/* Catch-all redirects to home */}
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Helper component to redirect based on auth status
function AuthRedirector() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default App;
