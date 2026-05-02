"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  CredentialsSignin: "Invalid email or password. Please try again.",
  Default: "Something went wrong. Please try again.",
};

function RegisteredBanner() {
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  if (!registered) return null;

  return (
    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
      Account created! Sign in to continue.
    </div>
  );
}

function ErrorBanner() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorMessage = errorParam ? (errorMessages[errorParam] || errorMessages.Default) : "";

  if (!errorMessage) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
      {errorMessage}
    </div>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    await signIn("credentials", { email, password, redirect: true, callbackUrl });
  };

  return (
    <>
      {/* Mobile logo */}
      <div className="md:hidden flex items-center justify-center mb-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900">SocialPilot</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to your account to continue
        </p>
      </div>

      <Suspense fallback={null}>
        <RegisteredBanner />
      </Suspense>
      <Suspense fallback={null}>
        <ErrorBanner />
      </Suspense>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-slate-900 hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
