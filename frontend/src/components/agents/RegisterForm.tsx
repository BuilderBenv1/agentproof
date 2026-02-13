"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useBalance } from "wagmi";
import { formatEther } from "viem";
import { useRegisterAgent, useIsRegistered } from "@/hooks/useContract";
import { CATEGORIES, PROTOCOL_FEE } from "@/lib/constants";
import WalletButton from "@/components/ui/WalletButton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { CheckCircle, AlertCircle, Plus, X, Zap, Shield, Globe } from "lucide-react";
import { explorerTxUrl } from "@/lib/utils";

export default function RegisterForm() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isRegistered, isLoading: checkingRegistration } = useIsRegistered(address);
  const { register, registerHash, feeHash, isPending, isConfirming, isSuccess, agentId, statusText, error } = useRegisterAgent();
  const { data: balance } = useBalance({ address });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointType, setEndpointType] = useState("https");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capInput, setCapInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Redirect to agent profile after successful registration
  useEffect(() => {
    if (isSuccess && agentId) {
      const timer = setTimeout(() => {
        router.push(`/agents/${agentId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, agentId, router]);

  function addCapability() {
    const trimmed = capInput.trim();
    if (trimmed && !capabilities.includes(trimmed) && capabilities.length < 10) {
      setCapabilities([...capabilities, trimmed]);
      setCapInput("");
    }
  }

  function removeCapability(cap: string) {
    setCapabilities(capabilities.filter((c) => c !== cap));
  }

  function handleCapKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCapability();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const metadata = {
      name,
      description,
      category,
      image: imageUrl || undefined,
      capabilities,
      endpoints: endpointUrl
        ? [{ url: endpointUrl, type: endpointType }]
        : [],
    };

    // For MVP, use a data URI. In production, upload to IPFS first.
    const dataUri = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
    register(dataUri);
  }

  const hasEnoughBalance = balance && balance.value >= PROTOCOL_FEE;
  const feeDisplay = formatEther(PROTOCOL_FEE);

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
        <Shield className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400 text-sm mb-6">
          Connect your wallet to register an AI agent on Avalanche Mainnet
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
        <p className="text-gray-400 text-sm mb-4">
          This wallet already has a registered agent.
        </p>
        <a
          href="/agents"
          className="text-emerald-400 text-sm font-mono hover:underline"
        >
          View agents
        </a>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="bg-gray-900/50 border border-emerald-500/30 rounded-xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Agent Registered!</h2>
        <p className="text-gray-400 text-sm mb-4">
          Your agent identity has been minted on Avalanche.
          {agentId && <> Agent ID: <span className="text-emerald-400 font-mono">#{agentId}</span></>}
        </p>
        <div className="flex flex-col items-center gap-3">
          {registerHash && (
            <a
              href={explorerTxUrl(registerHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 text-xs font-mono hover:underline"
            >
              View transaction on Snowtrace
            </a>
          )}
          {agentId && (
            <p className="text-xs text-gray-500">
              Redirecting to your agent profile...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
      {/* Agent Name */}
      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          Agent Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={64}
          placeholder="My DeFi Agent"
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          Description *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          maxLength={500}
          placeholder="Describe what your agent does, its purpose, and key functionality..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
        <p className="text-xs text-gray-600 mt-1 text-right">{description.length}/500</p>
      </div>

      {/* Category */}
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

      {/* Endpoint URL */}
      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          <Globe className="w-3 h-3 inline mr-1" />
          Endpoint URL
        </label>
        <div className="flex gap-2">
          <select
            value={endpointType}
            onChange={(e) => setEndpointType(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-400 focus:outline-none focus:border-emerald-500/50 w-28"
          >
            <option value="https">HTTPS</option>
            <option value="a2a">A2A</option>
            <option value="mcp">MCP</option>
            <option value="websocket">WebSocket</option>
          </select>
          <input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="https://api.myagent.com/v1"
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <p className="text-xs text-gray-600 mt-1">The primary endpoint where your agent can be reached</p>
      </div>

      {/* Capabilities */}
      <div>
        <label className="block text-xs font-mono text-gray-400 uppercase mb-1.5">
          <Zap className="w-3 h-3 inline mr-1" />
          Capabilities
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            onKeyDown={handleCapKeyDown}
            placeholder="e.g. yield-optimization, swap-execution..."
            maxLength={40}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={addCapability}
            disabled={!capInput.trim() || capabilities.length >= 10}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 px-3 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {capabilities.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {capabilities.map((cap) => (
              <span
                key={cap}
                className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono px-2.5 py-1 rounded-full"
              >
                {cap}
                <button type="button" onClick={() => removeCapability(cap)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-600 mt-1">Add up to 10 capabilities. Press Enter or click + to add.</p>
      </div>

      {/* Image URL */}
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

      {/* Fee Breakdown */}
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 space-y-2">
        <p className="text-xs font-mono text-gray-500 uppercase">Registration Cost</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Protocol fee</span>
          <span className="text-sm font-mono text-white">{feeDisplay} AVAX</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">ERC-8004 mint</span>
          <span className="text-sm font-mono text-gray-500">+ gas</span>
        </div>
        <div className="border-t border-gray-700/50 pt-2 mt-2 flex items-center justify-between">
          <span className="text-sm text-gray-300 font-medium">Total</span>
          <span className="text-sm font-mono text-emerald-400">{feeDisplay} AVAX + gas</span>
        </div>
        {balance && (
          <p className={`text-xs font-mono mt-1 ${hasEnoughBalance ? "text-gray-500" : "text-red-400"}`}>
            Wallet balance: {Number(formatEther(balance.value)).toFixed(4)} AVAX
            {!hasEnoughBalance && " — insufficient funds"}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="text-xs font-mono">{error.message}</span>
        </div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || isConfirming || !name || !description || !hasEnoughBalance}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isPending || isConfirming ? (
            <>
              <LoadingSpinner size="sm" />
              {statusText || "Processing..."}
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Register Agent — {feeDisplay} AVAX
            </>
          )}
        </button>

        {/* Step indicator */}
        {(isPending || isConfirming) && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className={`flex items-center gap-1.5 text-xs font-mono ${
              statusText?.includes("fee") || statusText?.includes("protocol")
                ? "text-emerald-400"
                : feeHash ? "text-gray-500" : "text-gray-700"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                statusText?.includes("fee") || statusText?.includes("protocol")
                  ? "bg-emerald-400 animate-pulse"
                  : feeHash ? "bg-gray-500" : "bg-gray-700"
              }`} />
              1. Fee
            </div>
            <div className="w-6 border-t border-gray-700" />
            <div className={`flex items-center gap-1.5 text-xs font-mono ${
              statusText?.includes("registration") || statusText?.includes("Minting")
                ? "text-emerald-400"
                : "text-gray-700"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                statusText?.includes("registration") || statusText?.includes("Minting")
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-gray-700"
              }`} />
              2. Mint
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
