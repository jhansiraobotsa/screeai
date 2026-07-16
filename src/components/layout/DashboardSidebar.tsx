import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  Video,
  FileText,
  Settings,
  LogOut,
  Brain,
  BarChart3,
  UserCheck,
  Building2,
  Briefcase,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

// The entire dashboard is admin-only (see App.tsx route guard), so every item
// is tagged admin for consistency.
const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Jobs", href: "/jobs", icon: Briefcase, roles: ["admin"] },
  { label: "Applicants", href: "/applicants", icon: FileText, roles: ["admin"] },
  { label: "Interviews", href: "/interviews", icon: Video, roles: ["admin"] },
  { label: "Candidates", href: "/candidates", icon: Users, roles: ["admin"] },
  { label: "Question Packs", href: "/question-packs", icon: Brain, roles: ["admin"] },
  { label: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin"] },
  { label: "Costs", href: "/costs", icon: DollarSign, roles: ["admin"] },
  { label: "User Management", href: "/admin/users", icon: UserCheck, roles: ["admin"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

export default function DashboardSidebar() {
  const location = useLocation();
  const { role, signOut, user } = useAuth();
  const { profile } = useProfile();

  const filteredItems = navItems.filter(
    item => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
          <Brain className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Screen.ai</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredItems.map(item => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <Link to="/settings" className="flex items-center gap-3 mb-3 rounded-lg px-1 py-1 -mx-1 hover:bg-sidebar-accent transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sm font-semibold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || user?.email}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{role || "member"}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
