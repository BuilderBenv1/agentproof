"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/ui/WalletButton";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/discover", label: "Discover" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/register", label: "Register" },
  { href: "/mcp", label: "MCP" },
  { href: "/whitepaper", label: "Whitepaper" },
  { href: "/docs", label: "Docs" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Shield className="w-6 h-6 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
            <span className="text-lg font-bold text-white">
              Agent<span className="text-emerald-400">Proof</span>
            </span>
            <span className="hidden lg:inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/20 rounded">
              ERC-8004
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-mono transition-colors ${
                  pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Wallet + Mobile Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <WalletButton />
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-mono ${
                  pathname === link.href
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-gray-400"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 px-3">
              <WalletButton />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
