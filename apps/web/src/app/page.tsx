import Link from "next/link";
import { ArrowRight, Sparkles, Calendar, BarChart3, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-xl">SocialPilot</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold tracking-tight mb-6">
              Create and schedule social media content with AI
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              SocialPilot uses AI to generate platform-specific posts, create stunning images,
              and automatically publish them on the best time for your audience.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl border bg-card">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI Content Generation</h3>
                <p className="text-gray-600">
                  Describe your campaign and let AI generate platform-specific captions, hashtags, and CTAs.
                </p>
              </div>
              <div className="p-6 rounded-xl border bg-card">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Smart Scheduling</h3>
                <p className="text-gray-600">
                  Drag and drop posts to schedule them. AI suggests the best times for maximum engagement.
                </p>
              </div>
              <div className="p-6 rounded-xl border bg-card">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Analytics Dashboard</h3>
                <p className="text-gray-600">
                  Track engagement, reach, and performance across all platforms in one dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-8">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium text-gray-600">Coming soon</span>
            </div>
            <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {["Instagram", "Facebook", "LinkedIn", "Twitter / X"].map((platform) => (
                <div key={platform} className="p-4 rounded-lg border bg-white text-center">
                  <span className="font-medium">{platform}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          © 2026 SocialPilot. All rights reserved.
        </div>
      </footer>
    </div>
  );
}