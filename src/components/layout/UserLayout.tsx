import { Outlet } from "react-router-dom";
import UserNavbar from "./UserNavbar";

export default function UserLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <UserNavbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
