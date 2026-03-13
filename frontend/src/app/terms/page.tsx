import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "AgentProof Terms of Service — legal terms governing use of the AgentProof trust oracle, API, and reputation scoring platform.",
  alternates: { canonical: "https://agentproof.sh/terms" },
};
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-400 transition-colors mb-8"
      >
        <ArrowLeft className="w-3 h-3" /> Back
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-xs font-mono text-gray-500 mb-10">
        Last updated: March 12, 2026
      </p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the AgentProof platform, API, oracle services,
            or website (collectively, the &ldquo;Service&rdquo;), you agree to be bound by
            these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use
            the Service. These Terms constitute a legally binding agreement
            between you and AgentProof (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
          <p>
            AgentProof provides an on-chain reputation oracle for AI agents. The
            Service includes trust scoring, agent registration, API access, badge
            generation, and related tooling. Trust scores are generated using a
            multi-signal scoring algorithm that evaluates on-chain data,
            transaction history, liveness, and other publicly available information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            3. Disclaimer of Warranties &amp; Scores
          </h2>
          <p className="font-mono text-xs text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 rounded p-3 mb-3">
            IMPORTANT: Trust scores, risk assessments, and all outputs of the
            AgentProof oracle are provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo;
            basis for informational purposes only.
          </p>
          <p>
            AgentProof trust scores do not constitute financial advice, investment
            recommendations, endorsements, guarantees of agent reliability, or
            warranties of any kind, whether express or implied. Scores reflect
            algorithmic analysis of publicly available on-chain data and may be
            incomplete, delayed, or inaccurate.
          </p>
          <p className="mt-2">
            We expressly disclaim all warranties, including but not limited to
            implied warranties of merchantability, fitness for a particular
            purpose, accuracy, and non-infringement. You assume all risk
            associated with reliance on trust scores or any other output of the
            Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, AgentProof, its
            officers, directors, employees, and agents shall not be liable for
            any indirect, incidental, special, consequential, or punitive
            damages, including but not limited to loss of profits, data, or
            other intangible losses, arising out of or relating to your use of
            or inability to use the Service, any trust score or assessment
            provided by the Service, any unauthorized access to or alteration of
            your data, or any third-party conduct on the Service.
          </p>
          <p className="mt-2">
            Our total aggregate liability for all claims arising out of or
            relating to these Terms or the Service shall not exceed the greater
            of (a) the amount you paid us in the 12 months preceding the claim,
            or (b) one hundred US dollars ($100).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. API Usage &amp; Billing</h2>
          <p>
            API access is governed by your selected pricing tier. By registering
            for an API key, you agree to the pricing terms of your tier as
            published at{" "}
            <Link href="/pricing" className="text-emerald-400 hover:underline">
              agentproof.sh/pricing
            </Link>
            .
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>
              <strong className="text-gray-300">Pay-per-call (paygo):</strong>{" "}
              Billed at $0.05 per API call. No monthly commitment.
            </li>
            <li>
              <strong className="text-gray-300">Subscription tiers:</strong>{" "}
              Monthly fee with included call allocation. Calls exceeding your
              allocation are billed as overage at $0.05 per call.
            </li>
            <li>
              <strong className="text-gray-300">Overage consent:</strong>{" "}
              By subscribing to any paid tier, you expressly consent to overage
              billing at the stated per-call rate when your monthly allocation is
              exceeded. You may set up usage alerts or request a hard cap by
              contacting support.
            </li>
            <li>
              <strong className="text-gray-300">Promotional tiers:</strong>{" "}
              Free-tier access (including hackathon and partner tiers) may be
              time-limited and can be modified or revoked at our discretion with
              reasonable notice.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. API Key Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your API
            key. API keys are shown once at registration and cannot be retrieved.
            You may rotate your key at any time via the API. You must not share,
            publish, or embed API keys in client-side code. We are not liable for
            unauthorized use of your API key.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to manipulate, game, or falsify trust scores</li>
            <li>Circumvent rate limits or abuse free-tier access</li>
            <li>Reverse-engineer the scoring algorithm for competitive purposes</li>
            <li>Use the Service to harass, defame, or harm other users or agents</li>
            <li>Resell API access without prior written authorization</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Dispute Resolution &amp; Arbitration</h2>
          <p>
            Any dispute arising out of or relating to these Terms or the Service
            shall be resolved through binding arbitration in accordance with the
            rules of the American Arbitration Association. The arbitration shall
            be conducted in English. You waive any right to participate in a
            class action lawsuit or class-wide arbitration.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the
            laws of the State of Delaware, without regard to its conflict of law
            provisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless AgentProof and its
            affiliates from any claims, damages, losses, or expenses (including
            reasonable attorneys&apos; fees) arising out of your use of the Service,
            your violation of these Terms, or your violation of any rights of a
            third party.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">11. Modification &amp; Termination</h2>
          <p>
            We reserve the right to modify these Terms at any time. Material
            changes will be communicated via the Service or email. Continued use
            after changes constitutes acceptance. We may suspend or terminate
            your access at any time for violation of these Terms, with or without
            notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">12. ERC-8004 Standard</h2>
          <p>
            AgentProof implements the draft ERC-8004 standard for on-chain agent
            identity. ERC-8004 is a proposed Ethereum Improvement Proposal and
            has not been ratified. Our implementation may diverge from future
            versions of the standard.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">13. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a
              href="mailto:legal@agentproof.sh"
              className="text-emerald-400 hover:underline"
            >
              legal@agentproof.sh
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
