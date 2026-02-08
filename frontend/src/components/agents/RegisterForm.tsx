"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRegisterAgent, useIsRegistered } from "@/hooks/useContract";
import { CATEGORIES } from "@/lib/constants";
import WalletButton from "@/components/ui/WalletButton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function RegisterForm() {
  const { address, isConnected } = useAccount();
  const { isRegistered, isLoading: checkingRegistration } = useIsRegistered(address);
  const { register, hash, isPending, isConfirming, isSuccess, error } = useRegisterAgent();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [imageUrl, setImageUrl] = useState("");
  const [endpoints, setEndpoints] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Build agent metadata URI (in production, upload to IPFS)
    const metadata = {
      name,
      description,
      category,
      image: imageUrl,
      endpoints: endpoints
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean),
    };

    // For MVP, use a data URI. In production, upload to IPFS first.
    const dataUri = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
    register(dataUri);
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-4">Connect Your Wallet</h2>
        <p className="text-gray-400 text-sm mb-6">
          Connect your wallet to register an AI agent on AgentProof
        </p>
        <div className="flex justify-center">
          <WalletButton />
        </div>
      </div>
    );
  }

  if (checkingRegistration) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (isRegistered) {
    return (
      <div className="bg-gray-900/50 border border-emerald-500/30 rounded-xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Already Registered</h2>
        <p className="text-gray-400 text-sm">
          This wallet already has a registered agent.
        </p>
      </div>
    );
  }

  if (isSuccess && hash) {
    return (
      <div className="bg-gray-900/50 border border-emerald-500/30 rounded-xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Agent Registered!</h2>
        <p className="text-gray-400 text-sm mb-4">
          Your agent has been registered on-chain.
        </p>
        <a
          href={`https://snowtrace.io/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 text-sm font-mono hover:underline"
        >
          View transaction
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          Agent Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My DeFi Agent"
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          Description *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Describe what your agent does..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500/50"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          Image URL (optional)
        </label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          API Endpoints (one per line, optional)
        </label>
        <textarea
          value={endpoints}
          onChange={(e) => setEndpoints(e.target.value)}
          rows={2}
          placeholder={"https://api.myagent.com/v1\nhttps://api.myagent.com/health"}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error.message || "Transaction failed"}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || isConfirming || !name || !description}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isPending || isConfirming ? (
            <>
              <LoadingSpinner size="sm" />
              {isPending ? "Confirm in wallet..." : "Confirming..."}
            </>
          ) : (
            "Register Agent"
          )}
        </button>
      </div>
    </form>
  );
}
