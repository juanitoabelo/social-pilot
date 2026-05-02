"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Megaphone, 
  Image, 
  Calendar, 
  BarChart3, 
  Settings,
  Sparkles,
  Menu,
  X,
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/content-library", label: "Content Library", icon: Image },
  { href: "/dashboard/schedule", label: "Schedule", icon: Calendar },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/activity-log", label: "Activity Log", icon: ClipboardList },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-xl">SocialPilot</span>
        </Link>
      </div>
      
      <nav className="px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-1",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border shadow-sm"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside className="hidden lg:block fixed left-0 top-0 w-64 bg-white border-r h-screen z-40">
        <SidebarContent />
      </aside>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsMobileOpen(false)} 
          />
          <aside className="relative w-64 bg-white h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}