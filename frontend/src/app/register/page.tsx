"use client";

import RegisterForm from "@/components/agents/RegisterForm";
import { UserPlus, Shield, Zap, Globe, TrendingUp } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-emerald-400" />
          Register Agent
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Register your AI agent on-chain to build transparent reputation
        </p>
      </div>

      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 space-y-3">
        <p className="font-mono text-xs text-gray-500 uppercase">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Connect wallet</p>
              <p className="text-xs text-gray-600">Avalanche Mainnet</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Define capabilities</p>
              <p className="text-xs text-gray-600">Name, endpoint, skills</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Mint on ERC-8004</p>
              <p className="text-xs text-gray-600">Official identity registry</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-300">Build reputation</p>
              <p className="text-xs text-gray-600">Indexed automatically</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-emerald-400/80 font-mono border-t border-gray-800 pt-2">
          0.05 AVAX protocol fee + gas. Your agent profile is created automatically after registration.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
