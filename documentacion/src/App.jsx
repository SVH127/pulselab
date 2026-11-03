import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { dataClient } from '@/api/dataClient';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Activate from '@/pages/Activate';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Layouts
import TeacherLayout from '@/components/TeacherLayout';
import StudentLayout from '@/components/StudentLayout';

// Teacher pages
import CaseList from '@/pages/CaseList';
import CaseEditor from '@/pages/CaseEditor';
import Reports from '@/pages/Reports';
import UserManagement from '@/pages/UserManagement';

// Student pages
import StudentCases from '@/pages/StudentCases';
import CaseSession from '@/pages/CaseSession';

const RoleRedirect = () => {
  const [target, setTarget] = React.useState(null);
  React.useEffect(() => {
    dataClient.auth.me().then(user => {
      setTarget(user?.role === 'admin' ? '/teacher/cases' : '/student/cases');
    }).catch(() => setTarget('/student/cases'));
  }, []);
  if (!target) return null;
  return <Navigate to={target} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Cargando Virtual Beat...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>

        {/* Root redirect by role */}
        <Route path="/" element={<RoleRedirect />} />

        {/* Teacher routes */}
        <Route element={<TeacherLayout />}>
          <Route path="/teacher/cases" element={<CaseList />} />
          <Route path="/teacher/cases/new" element={<CaseEditor />} />
          <Route path="/teacher/cases/:id" element={<CaseEditor />} />
          <Route path="/teacher/reports" element={<Reports />} />
          <Route path="/teacher/students" element={<UserManagement />} />
        </Route>

        {/* Student routes */}
        <Route element={<StudentLayout />}>
          <Route path="/student/cases" element={<StudentCases />} />
          <Route path="/student/cases/:id" element={<CaseSession />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
