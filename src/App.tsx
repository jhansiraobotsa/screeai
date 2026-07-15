import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Interviews from "./pages/Interviews";
import Candidates from "./pages/Candidates";
import Jobs from "./pages/Jobs";
import JobApplicants from "./pages/JobApplicants";
import Applicants from "./pages/Applicants";
import QuestionPacks from "./pages/QuestionPacks";
import SettingsPage from "./pages/SettingsPage";
import Analytics from "./pages/Analytics";
import InterviewRoom from "./pages/InterviewRoom";
import CandidatePortal from "./pages/CandidatePortal";
import Spaces from "./pages/Spaces";
import NewMockSession from "./pages/NewMockSession";
import AdminUserManagement from "./pages/AdminUserManagement";
import DashboardLayout from "./components/layout/DashboardLayout";
import UserLayout from "./components/layout/UserLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRedirect from "./components/common/RoleBasedRedirect";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Role-based root redirect */}
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/candidate/:invite" element={<CandidatePortal />} />
          <Route path="/interview-room/:id" element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />

          {/* User routes (Spaces layout) */}
          <Route
            element={
              <ProtectedRoute>
                <UserLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/spaces" element={<Spaces />} />
            <Route path="/new-session" element={<NewMockSession />} />
          </Route>

          {/* Admin-only routes (Dashboard layout). NOTE: this is a UI-layer
              guard only — real enforcement requires database RLS (not yet added). */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:jobId/applicants" element={<JobApplicants />} />
            <Route path="/applicants" element={<Applicants />} />
            <Route path="/interviews" element={<Interviews />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/question-packs" element={<QuestionPacks />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/admin/users" element={<AdminUserManagement />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
