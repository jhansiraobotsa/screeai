import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mic, Brain, Video } from "lucide-react";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        navigate(redirect || "/spaces");
      } else if (mode === "signup") {
        await signUp(email, password, fullName);
        toast.success("Check your email to confirm your account");
      } else {
        await resetPassword(email);
        toast.success("Password reset email sent");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-bg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0yaDZWMjhoLTZ2NHptLTIgMmgtNHY2aDR2LTZ6bTAtMnYtNGgtNHY0aDR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-primary-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold tracking-tight mb-4">
              Screen.ai
            </h1>
            <p className="text-xl opacity-90 mb-12 max-w-md">
              Enterprise AI interviews — real-time speech, live transcription, intelligent evaluation.
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              { icon: Video, label: "Live Video Interviews", desc: "HD video calls with real-time AI interaction" },
              { icon: Mic, label: "Voice-Powered AI", desc: "Natural speech with live transcription" },
              { icon: Brain, label: "Smart Evaluation", desc: "Resume-grounded questions & structured scoring" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex items-start gap-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm opacity-75">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {mode === "login" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "forgot" && "Reset password"}
              </CardTitle>
              <CardDescription>
                {mode === "login" && "Sign in to your InterviewAI account"}
                {mode === "signup" && "Get started with AI-powered interviews"}
                {mode === "forgot" && "We'll send you a reset link"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" variant="gradient" disabled={loading}>
                  {loading ? "Loading..." : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
                {mode === "login" && (
                  <>
                    <button onClick={() => setMode("forgot")} className="text-primary hover:underline block mx-auto">
                      Forgot password?
                    </button>
                    <p>
                      Don't have an account?{" "}
                      <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                        Sign up
                      </button>
                    </p>
                  </>
                )}
                {(mode === "signup" || mode === "forgot") && (
                  <p>
                    Already have an account?{" "}
                    <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
