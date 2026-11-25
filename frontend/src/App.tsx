import { ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InquiriesPage } from './pages/InquiriesPage';
import { InquiryDetailPage } from './pages/InquiryDetailPage';
import { LoginPage } from './pages/LoginPage';
import { NewInquiryPage } from './pages/NewInquiryPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page">
        <div className="card state-box" aria-busy="true">
          <div className="spinner" aria-hidden="true" />
          <p>Checking session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AppShell>{children}</AppShell>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/inquiries"
        element={
          <RequireAuth>
            <InquiriesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inquiries/new"
        element={
          <RequireAuth>
            <NewInquiryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inquiries/:id"
        element={
          <RequireAuth>
            <InquiryDetailPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/inquiries" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
