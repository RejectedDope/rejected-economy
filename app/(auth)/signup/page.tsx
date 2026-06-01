"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/app/actions/auth";
import { useToast } from "@/components/ui/use-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);

    // Point email confirmation to our callback route which exchanges the code
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;

    const result = await signUpAction(data.email, data.password, redirectTo);

    if (!result.ok) {
      toast({
        title: "Signup failed",
        description: result.error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (result.requiresConfirmation) {
      // Email confirmation required — show confirmation state
      setConfirmed(true);
    } else {
      // Auto-confirmed (email confirmations disabled in Supabase settings)
      toast({ title: "Account created", description: "You're in." });
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  }

  if (confirmed) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-400" />
          <h2 className="text-lg font-black text-zinc-100">Check your email</h2>
          <p className="mt-2 text-sm text-zinc-500">
            We sent a confirmation link to your email. Click it to activate your account,
            then sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 block text-sm font-semibold text-[#E935C1] hover:text-[#FF2D95]"
          >
            Back to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-black text-zinc-100">Create Account</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Free inventory recovery audit. No credit card.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="8+ characters"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat password"
              autoComplete="new-password"
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-xs text-red-400">{errors.confirm.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="text-[#E935C1] hover:text-[#FF2D95]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
