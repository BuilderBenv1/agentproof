import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-mono text-gray-500">
              AgentProof — Transparent reputation for AI agents
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-600">
            <span>Built on Avalanche</span>
            <span className="text-gray-800">|</span>
            <span>ERC-8004</span>
            <span className="text-gray-800">|</span>
            <span>Avalanche Mainnet</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
