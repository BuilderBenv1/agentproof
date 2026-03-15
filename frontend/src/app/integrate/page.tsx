import { redirect } from "next/navigation";

export const metadata = {
  title: "Integrate — AgentProof",
  description: "Get an API key and integrate AgentProof trust scores into your protocol.",
};

export default function IntegratePage() {
  redirect("https://oracle.agentproof.sh/integrate");
}
