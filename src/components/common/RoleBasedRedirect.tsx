import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function RoleBasedRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Role is fetched asynchronously after `loading` clears. Wait for it before
  // deciding where to land, so an admin isn't briefly sent to /spaces.
  if (role === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role === "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/spaces" replace />;
}
