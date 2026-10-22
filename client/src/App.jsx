import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MarkAttendance from './pages/MarkAttendance';
import AttendanceLog from './pages/AttendanceLog';
import Workers from './pages/Workers';
import WorkerDetail from './pages/WorkerDetail';
import Advances from './pages/Advances';
import Payroll from './pages/Payroll';
import PayrollDetail from './pages/PayrollDetail';
import Sites from './pages/Sites';
import Users from './pages/Users';
import Account from './pages/Account';

function RequireAuth({ children, admin }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<MarkAttendance />} />
        <Route path="attendance/log" element={<AttendanceLog />} />
        <Route path="workers" element={<Workers />} />
        <Route path="workers/:id" element={<WorkerDetail />} />
        <Route path="advances" element={<Advances />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="payroll/:id" element={<PayrollDetail />} />
        <Route path="sites" element={<RequireAuth admin><Sites /></RequireAuth>} />
        <Route path="users" element={<RequireAuth admin><Users /></RequireAuth>} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
