import { Outlet } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="flex justify-end px-8 pt-4">
          <NotificationBell />
        </div>
        <div className="px-8 pb-8 pt-2">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
