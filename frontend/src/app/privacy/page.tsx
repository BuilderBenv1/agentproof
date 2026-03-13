import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AgentProof Privacy Policy — how we collect, use, and protect data in the AgentProof trust oracle platform.",
  alternates: { canonical: "https://agentproof.sh/privacy" },
};
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-400 transition-colors mb-8"
      >
        <ArrowLeft className="w-3 h-3" /> Back
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-xs font-mono text-gray-500 mb-10">
        Last updated: March 12, 2026
      </p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
          <p>
            AgentProof (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy. This
            Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use the AgentProof platform, API, and
            website (collectively, the &ldquo;Service&rdquo;).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>

          <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">
            2.1 Information You Provide
          </h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>
              <strong className="text-gray-300">API registration:</strong>{" "}
              Protocol name, contact email address
            </li>
            <li>
              <strong className="text-gray-300">Agent registration:</strong>{" "}
              Wallet address, agent metadata (name, description, category, endpoints)
            </li>
            <li>
              <strong className="text-gray-300">Billing:</strong>{" "}
              Billing email address for paid tier subscriptions
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">
            2.2 Information Collected Automatically
          </h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>
              <strong className="text-gray-300">API usage data:</strong>{" "}
              Request counts, endpoints accessed, timestamps, rate limit events
            </li>
            <li>
              <strong className="text-gray-300">IP addresses:</strong>{" "}
              For rate limiting and abuse prevention
            </li>
            <li>
              <strong className="text-gray-300">Browser/device information:</strong>{" "}
              User agent, referrer (website visitors only)
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">
            2.3 On-Chain Data
          </h3>
          <p>
            We collect and process publicly available blockchain data including
            wallet addresses, transaction history, contract deployment records,
            and on-chain interactions across supported blockchains. This data is
            publicly available on blockchain explorers and is not considered
            private. However, we recognize that wallet addresses combined with
            behavioral data may constitute personal data under certain
            jurisdictions (see Section 7).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Generate trust scores and reputation assessments for AI agents</li>
            <li>Provide and maintain the Service, including API access</li>
            <li>Process billing and manage subscriptions</li>
            <li>Enforce rate limits and prevent abuse</li>
            <li>Communicate service updates, billing notices, and security alerts</li>
            <li>Improve the accuracy of our scoring algorithms</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p className="mt-2">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>
              <strong className="text-gray-300">Service providers:</strong>{" "}
              Supabase (database), Railway (hosting), Vercel (frontend hosting)
              — under data processing agreements
            </li>
            <li>
              <strong className="text-gray-300">On-chain publication:</strong>{" "}
              Trust scores and agent metadata may be published to public
              blockchains. Once published on-chain, this data cannot be deleted.
            </li>
            <li>
              <strong className="text-gray-300">Legal requirements:</strong>{" "}
              When required by law, subpoena, or legal process
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active or as
            needed to provide the Service. API keys are soft-deleted
            (deactivated) rather than hard-deleted to maintain audit trails.
            Usage data is retained for billing and analytics purposes for up to
            24 months. On-chain data is permanent and cannot be deleted due to
            the immutable nature of blockchain technology.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Data Security</h2>
          <p>
            We implement industry-standard security measures including: API keys
            stored as SHA-256 hashes (never in plaintext), encrypted connections
            (TLS/HTTPS), rate limiting and abuse detection, and access controls
            on internal systems. However, no method of electronic transmission or
            storage is 100% secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            7. Your Rights (GDPR / CCPA)
          </h2>
          <p>
            Depending on your jurisdiction, you may have the following rights:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>
              <strong className="text-gray-300">Access:</strong>{" "}
              Request a copy of the personal data we hold about you
            </li>
            <li>
              <strong className="text-gray-300">Rectification:</strong>{" "}
              Request correction of inaccurate data
            </li>
            <li>
              <strong className="text-gray-300">Erasure:</strong>{" "}
              Request deletion of your data (subject to limitations for on-chain
              data and legal retention requirements)
            </li>
            <li>
              <strong className="text-gray-300">Portability:</strong>{" "}
              Request your data in a machine-readable format
            </li>
            <li>
              <strong className="text-gray-300">Objection:</strong>{" "}
              Object to processing of your data for certain purposes
            </li>
            <li>
              <strong className="text-gray-300">Non-discrimination (CCPA):</strong>{" "}
              We will not discriminate against you for exercising your privacy rights
            </li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:privacy@agentproof.sh"
              className="text-emerald-400 hover:underline"
            >
              privacy@agentproof.sh
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            8. Lawful Basis for Processing (GDPR)
          </h2>
          <p>For users in the European Economic Area, we process your data on the following bases:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>
              <strong className="text-gray-300">Contract performance:</strong>{" "}
              Processing necessary to provide the Service you requested
            </li>
            <li>
              <strong className="text-gray-300">Legitimate interest:</strong>{" "}
              Scoring and reputation analysis of publicly available on-chain data,
              fraud prevention, service improvement
            </li>
            <li>
              <strong className="text-gray-300">Legal obligation:</strong>{" "}
              Where required by law
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Cookies</h2>
          <p>
            The AgentProof website uses only essential cookies required for
            functionality (session management, wallet connection state). We do
            not use advertising or tracking cookies. No third-party analytics
            cookies are set.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">10. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for individuals under 18 years of age. We
            do not knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">11. International Data Transfers</h2>
          <p>
            Your data may be processed in the United States and other countries
            where our service providers operate. By using the Service, you
            consent to the transfer of your data to these jurisdictions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes
            will be communicated via the Service or email. Continued use after
            changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">13. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{" "}
            <a
              href="mailto:privacy@agentproof.sh"
              className="text-emerald-400 hover:underline"
            >
              privacy@agentproof.sh
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
