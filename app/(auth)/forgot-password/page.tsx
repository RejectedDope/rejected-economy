"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/app/actions/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    const result = await resetPasswordAction(data.email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h1 className="mt-4 text-xl font-black text-zinc-100">Check your email</h1>
            <p className="mt-2 text-sm text-zinc-500">
              We sent a password reset link. It expires in 1 hour.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm text-[#E935C1] hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Link
                href="/login"
                className="mb-4 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
              <h1 className="text-xl font-black text-zinc-100">Reset your password</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Enter your email and we&apos;ll send a reset link.
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

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
