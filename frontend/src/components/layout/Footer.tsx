import Link from "next/link";
import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[#2a2a3a] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">AgentProof</span>
            </div>
            <p className="text-xs font-mono text-gray-500 italic">
              Verification today. Economic participation tomorrow.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-xs font-mono">
            <Link href="/docs" className="text-gray-500 hover:text-white transition-colors">
              API
            </Link>
            <Link href="/docs" className="text-gray-500 hover:text-white transition-colors">
              Docs
            </Link>
            <Link href="/agents" className="text-gray-500 hover:text-white transition-colors">
              Agent Directory
            </Link>
            <a
              href="https://github.com/BuilderBenv1/agentproof"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-3 text-[10px] font-mono text-gray-600">
            <span className="px-2 py-0.5 border border-[#2a2a3a] rounded">ERC-8004</span>
            <span className="px-2 py-0.5 border border-[#2a2a3a] rounded">Avalanche</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
