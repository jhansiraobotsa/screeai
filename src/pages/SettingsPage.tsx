import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, changePassword, deleteAccount } = useAuth();
  const { profile, updateProfile, uploadAvatar } = useProfile();

  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) setFullName(profile.full_name || "");
  }, [profile]);

  useEffect(() => {
    if (!profile?.org_id) return;
    supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.org_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOrgName(data.name);
      });
  }, [profile?.org_id]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }
    try {
      await uploadAvatar(file);
      toast.success("Avatar updated");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(newPassword);
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !user) return;
    setSavingOrg(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName })
        .select()
        .single();
      if (orgError) throw orgError;

      await supabase.from("user_roles").upsert({
        user_id: user.id,
        role: "admin" as const,
      }, { onConflict: "user_id,role" });

      await updateProfile({ org_id: org.id });
      toast.success("Organization created! You are now an admin.");
      window.location.reload();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success("Account deleted");
      navigate("/auth");
    } catch (err: unknown) {
      toast.error((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </motion.div>

      {/* ── Profile ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-sidebar-accent text-lg font-semibold">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
              >
                <Camera className="h-5 w-5 text-white" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="text-sm font-medium">{profile?.full_name || "No name set"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button variant="gradient" onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Change Password ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <Button
            variant="gradient"
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Organization ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            {profile?.org_id
              ? "You belong to an organization"
              : "Create an organization to start using interviews"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              disabled={!!profile?.org_id}
            />
          </div>
          {!profile?.org_id && (
            <Button variant="gradient" onClick={handleCreateOrg} disabled={savingOrg || !orgName.trim()}>
              {savingOrg ? "Creating..." : "Create Organization"}
            </Button>
          )}
          {profile?.org_id && (
            <p className="text-sm text-muted-foreground">
              Organization ID: <code className="text-xs font-mono">{profile.org_id}</code>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Danger Zone ─────────────────────────────────────── */}
      <Separator />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete Account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your
                  account and remove your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
