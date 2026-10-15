import React, { createContext, useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login      from './components/Login';
import Register   from './components/Register';
import Dashboard  from './components/Dashboard';
import SharedFile from './components/SharedFile';

const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [userId, setUserId] = useState(localStorage.getItem('userId'));

  const login  = (id) => { setUserId(id); localStorage.setItem('userId', id); };
  const logout = ()   => { setUserId(null); localStorage.removeItem('userId'); };

  return (
    <AuthContext.Provider value={{ userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ Component, redirectTo }) {
  const { userId } = useAuth();
  if (redirectTo === '/dashboard' && userId)  return <Navigate to={redirectTo} />;
  if (redirectTo === '/'          && !userId) return <Navigate to={redirectTo} />;
  return <Component />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/"          element={<ProtectedRoute Component={Login}     redirectTo="/dashboard" />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute Component={Dashboard} redirectTo="/" />} />
            {/* Public shared-file page — no login required */}
            <Route path="/shared/:token" element={<SharedFile />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export { useAuth };
export default App;