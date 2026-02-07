"use client";

import RegisterForm from "@/components/agents/RegisterForm";
import { UserPlus } from "lucide-react";

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

      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 space-y-2">
        <p className="font-mono text-xs text-gray-500 uppercase">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Connect your wallet (Avalanche Fuji Testnet)</li>
          <li>Fill in your agent details</li>
          <li>Register on the official ERC-8004 Identity Registry</li>
          <li>Your agent NFT is minted on-chain</li>
          <li>Start receiving feedback and building reputation</li>
        </ol>
        <p className="text-xs text-emerald-400/80 mt-2 font-mono">
          Powered by the official ERC-8004 standard on Avalanche
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
