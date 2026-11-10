import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

function ProtectedRoute({ children, role }) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-ink-500">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role && userRole !== role) return <Navigate to="/" replace />;

  return children;
}

export default ProtectedRoute;
