import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import LoginPage from '@/pages/LoginPage';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import SalesPage from '@/pages/SalesPage';
import NewSalePage from '@/pages/NewSalePage';
import SaleDetailPage from '@/pages/SaleDetailPage';
import ReportsPage from '@/pages/ReportsPage';
import SellerManagementPage from '@/pages/SellerManagementPage';
import TranscribeAudioPage from '@/pages/TranscribeAudioPage';
import SummarizePage from '@/pages/SummarizePage';
import SchedulePage from '@/pages/SchedulePage';
import AdminSettingsPage from '@/pages/AdminSettingsPage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/sales" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/sales" replace /> : <LoginPage />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Navigate to="/sales" replace />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/sales"
        element={
          <PrivateRoute>
            <DashboardLayout>
              <SalesPage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/sales/new"
        element={
          <PrivateRoute>
            <DashboardLayout>
              <NewSalePage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/sales/:id"
        element={
          <PrivateRoute>
            <DashboardLayout>
              <SaleDetailPage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/transcribe"
        element={
          <PrivateRoute>
            <DashboardLayout>
              <TranscribeAudioPage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/summarize"
        element={
          <PrivateRoute>
            <DashboardLayout>
              <SummarizePage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/reports"
        element={
          <PrivateRoute adminOnly={true}>
            <DashboardLayout>
              <ReportsPage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/sellers"
        element={
          <PrivateRoute adminOnly={true}>
            <DashboardLayout>
              <SellerManagementPage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/escala"
        element={
          <PrivateRoute adminOnly={true}>
            <DashboardLayout>
              <SchedulePage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin-settings"
        element={
          <PrivateRoute adminOnly={true}>
            <DashboardLayout>
              <AdminSettingsPage />
            </DashboardLayout>
          </PrivateRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Helmet>
          <title>Painel de Vendas Megumi Tarot</title>
        </Helmet>
        <AppRoutes />
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;