"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/app/actions/auth";
import { useToast } from "@/components/ui/use-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

// Isolated into a child component so Suspense can wrap useSearchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");
  const urlError = errorParam
    ? (messageParam ?? "Authentication failed. Please try again.")
    : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);

    const result = await signInAction(data.email, data.password);

    if (!result.ok) {
      toast({
        title: "Sign in failed",
        description: result.error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({ title: "Signed in", description: "Welcome back." });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-zinc-100">Sign In</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Back to work. Your death pile isn&apos;t going to clear itself.
        </p>
      </div>

      {/* Error from auth callback (expired link, failed confirmation, etc.) */}
      {urlError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{urlError}</p>
        </div>
      )}

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
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Sign In
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        No account?{" "}
        <Link href="/signup" className="text-[#E935C1] hover:text-[#FF2D95]">
          Create one free
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <Suspense
        fallback={
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      {/* Demo bypass */}
      <p className="mt-4 text-center text-xs text-zinc-700">
        No Supabase configured?{" "}
        <Link href="/dashboard" className="text-zinc-600 underline hover:text-zinc-400">
          View demo →
        </Link>
      </p>
    </div>
  );
}
