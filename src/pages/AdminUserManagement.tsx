import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ScheduleForUserDialog from "@/components/admin/ScheduleForUserDialog";

interface UserRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  org_id: string | null;
  role: string | null;
  email: string | null;
}

export default function AdminUserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ email: string; userId: string } | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      // Fetch ALL profiles (admins can read every profile via RLS) with roles.
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, org_id");

      if (error) {
        console.error("Error fetching users:", error);
        setLoading(false);
        return;
      }

      // Fetch roles for these users
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const userRows: UserRow[] = (profiles || []).map(p => ({
        ...p,
        role: roleMap.get(p.user_id) || "user",
        email: null, // Email not in profiles, shown via user_id reference
      }));

      setUsers(userRows);
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleScheduleFor = (user: UserRow) => {
    setSelectedUser({ email: "", userId: user.user_id });
    setScheduleOpen(true);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      // Remove any existing roles for this user, then set the new one, so a
      // user ends up with exactly one role row.
      const { error: delError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delError) throw delError;

      const { error: insError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole as "admin" | "user" });
      if (insError) throw insError;

      setUsers(prev => prev.map(u => (u.user_id === userId ? { ...u, role: newRole } : u)));
      toast.success(`Role updated to ${newRole}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setUpdatingRole(null);
    }
  };

  const roleBadge = (role: string | null) => {
    const colors: Record<string, string> = {
      admin: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      interviewer: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      user: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      candidate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return (
      <Badge variant="outline" className={`text-[11px] capitalize ${colors[role || "user"] || ""}`}>
        {role || "user"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage users and schedule interviews</p>
        </div>
        <Button onClick={() => { setSelectedUser(null); setScheduleOpen(true); }}>
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Interview
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Users ({filteredUsers.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-semibold">
                            {u.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{u.full_name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.user_id === currentUser?.id ? (
                        // Don't let an admin demote themselves and get locked out.
                        <div className="flex items-center gap-2">
                          {roleBadge(u.role)}
                          <span className="text-xs text-muted-foreground">(you)</span>
                        </div>
                      ) : (
                        <Select
                          value={u.role === "admin" ? "admin" : "user"}
                          onValueChange={val => handleRoleChange(u.user_id, val)}
                          disabled={updatingRole === u.user_id}
                        >
                          <SelectTrigger className="h-8 w-32">
                            {updatingRole === u.user_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleScheduleFor(u)}>
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        Schedule
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ScheduleForUserDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        prefillEmail={selectedUser?.email}
        prefillUserId={selectedUser?.userId}
      />
    </div>
  );
}
