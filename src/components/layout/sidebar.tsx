"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
  ClipboardList,
  UtensilsCrossed,
  Phone,
  BarChart3,
  Settings,
  LogOut,
  PhoneCall,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { restaurant } = useRestaurant();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 border-b px-6 py-4 hover:bg-gray-50 transition-colors">
        <PhoneCall className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold">Parallel Space</span>
      </Link>

      {/* Restaurant Name */}
      {restaurant && (
        <div className="border-b px-6 py-3">
          <p className="text-sm font-medium text-gray-900 truncate">
            {restaurant.name}
          </p>
          {restaurant.retell_phone_number && (
            <p className="text-xs text-gray-500 mt-0.5">
              {restaurant.retell_phone_number}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Kitchen Display Link */}
      <div className="px-3 pb-2">
        <Link
          href="/kitchen"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <UtensilsCrossed className="h-5 w-5" />
          Kitchen Display
        </Link>
      </div>

      {/* Sign Out */}
      <div className="border-t px-3 py-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-700"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
