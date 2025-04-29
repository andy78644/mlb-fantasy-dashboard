import React from 'react';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login } = useAuth();

  return (
    <div>
      <h1>Login</h1>
      <p>Please login with your Yahoo account to continue.</p>
      <button onClick={login}>Login with Yahoo</button>
    </div>
  );
}

export default LoginPage;
