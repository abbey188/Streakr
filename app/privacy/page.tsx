import type { Metadata } from "next";
import { LegalDoc, Section, Bullets } from "@/src/components/legal/LegalDoc";
import { LEGAL } from "@/src/components/legal/legalConfig";

export const metadata: Metadata = {
  title: "Privacy Policy · Streakr",
  description: "How Streakr collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro={
        <p>
          This Privacy Policy explains how {LEGAL.operator} (&ldquo;{LEGAL.appName},&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares, and protects
          personal data when you use the {LEGAL.appName} web app and related services
          (the &ldquo;Service&rdquo;). By using the Service you agree to this Policy.
          If you do not agree, please do not use the Service.
        </p>
      }
    >
      <Section n={1} title="Who we are">
        <p>
          The Service is operated by {LEGAL.operator}. For any privacy question, or to
          exercise your rights, contact us at{" "}
          <span className="text-slate-200">{LEGAL.privacyEmail}</span>. Where required,
          this address also serves as our point of contact for data-protection matters.
        </p>
      </Section>

      <Section n={2} title="Data we collect">
        <p>We collect the following categories of personal data:</p>
        <Bullets
          items={[
            <><strong className="text-slate-200">Account data</strong> — your email address and login identifiers (handled by our authentication provider, Privy), a Solana wallet address created for your account, your chosen username, and your avatar/mascot configuration.</>,
            <><strong className="text-slate-200">Gameplay data</strong> — your match picks, streaks, points, badges, group memberships, and leaderboard positions.</>,
            <><strong className="text-slate-200">Notification data</strong> — your notification preferences and, if you enable them, push-notification subscriptions.</>,
            <><strong className="text-slate-200">Technical data</strong> — IP address, device and browser information, and log/usage data generated when you interact with the Service.</>,
            <><strong className="text-slate-200">Cookies &amp; local storage</strong> — small identifiers used to keep you signed in and remember preferences (see section 8).</>,
            <><strong className="text-slate-200">Communications</strong> — messages you send us for support or other enquiries.</>,
          ]}
        />
        <p>
          We do <strong className="text-slate-200">not</strong> intentionally collect
          special-category data (e.g. health, biometrics) and ask that you do not submit it.
        </p>
      </Section>

      <Section n={3} title="How we use your data">
        <Bullets
          items={[
            "Create and operate your account, wallet identity, and gameplay (streaks, picks, leaderboards).",
            "Send you service and match-related notifications you have not opted out of.",
            "Keep the Service secure, prevent cheating, fraud, and abuse, and enforce our Terms.",
            "Understand and improve how the Service is used.",
            "Comply with legal obligations and respond to lawful requests.",
          ]}
        />
      </Section>

      <Section n={4} title="Legal bases (EEA/UK users)">
        <p>Where GDPR/UK GDPR applies, we rely on:</p>
        <Bullets
          items={[
            <><strong className="text-slate-200">Contract</strong> — to provide the Service you sign up for.</>,
            <><strong className="text-slate-200">Consent</strong> — for optional push notifications, marketing, and non-essential cookies. You may withdraw consent at any time.</>,
            <><strong className="text-slate-200">Legitimate interests</strong> — to secure the Service, prevent abuse, and improve the product, balanced against your rights.</>,
            <><strong className="text-slate-200">Legal obligation</strong> — where we must process data to comply with the law.</>,
          ]}
        />
      </Section>

      <Section n={5} title="How we share data (sub-processors)">
        <p>
          We do not sell your personal data. We share it only with service providers who
          process it on our behalf under contract, and only as needed to run the Service:
        </p>
        <Bullets
          items={LEGAL.subProcessors.map((p) => (
            <>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#FF4E00] hover:underline">
                {p.name}
              </a>{" "}
              — {p.purpose}.
            </>
          ))}
        />
        <p>
          Some information (such as your username, avatar, streak, and leaderboard rank) is
          visible to other users by design. Your email address and wallet private keys are
          never shown publicly. We may also disclose data if required by law, to protect our
          rights or users&rsquo; safety, or in connection with a corporate transaction.
        </p>
      </Section>

      <Section n={6} title="International transfers">
        <p>
          The Service and several providers listed above operate globally, including in the
          United States. Where we transfer data outside the EEA/UK, we rely on appropriate
          safeguards (such as Standard Contractual Clauses) or another lawful transfer
          mechanism.
        </p>
      </Section>

      <Section n={7} title="Data retention">
        <p>
          We keep personal data for as long as your account is active and as needed to
          provide the Service. After you delete your account, we remove or anonymise your
          personal data within a reasonable period, except where we must retain certain
          records to comply with legal obligations, resolve disputes, or enforce our
          agreements. Public blockchain records (e.g. a wallet address) may persist on the
          Solana network outside our control.
        </p>
      </Section>

      <Section n={8} title="Cookies & local storage">
        <p>
          We use strictly necessary cookies/local storage to keep you signed in (via Privy)
          and to remember preferences such as dismissed prompts and notification settings.
          If we introduce analytics or advertising in future, we will use those technologies
          only with your consent where required and update this Policy first.
        </p>
      </Section>

      <Section n={9} title="Your rights">
        <p>Depending on where you live, you may have the right to:</p>
        <Bullets
          items={[
            "Access the personal data we hold about you and receive a copy.",
            "Correct inaccurate data or complete incomplete data.",
            "Delete your data (“right to be forgotten”).",
            "Restrict or object to certain processing, including profiling.",
            "Port your data to another service.",
            "Withdraw consent at any time, without affecting prior processing.",
          ]}
        />
        <p>
          To exercise any of these, email{" "}
          <span className="text-slate-200">{LEGAL.privacyEmail}</span>. You also have the
          right to lodge a complaint with your local data-protection authority. California
          residents have rights under the CCPA/CPRA, including the right to know, delete, and
          opt out of &ldquo;sales/sharing&rdquo; — we do not sell personal data.
        </p>
      </Section>

      <Section n={10} title="Security">
        <p>
          We implement appropriate technical and organisational measures to protect personal
          data, including encryption of sensitive credentials, encrypted transport (HTTPS),
          and access controls. No method of transmission or storage is completely secure, so
          we cannot guarantee absolute security; we continue to strengthen our protections
          over time.
        </p>
      </Section>

      <Section n={11} title="Children">
        <p>
          The Service is intended for users aged {LEGAL.minAge} and over. We do not knowingly
          collect personal data from anyone under {LEGAL.minAge}. If we learn that we have,
          we will delete it. If you believe a minor has provided us data, contact{" "}
          <span className="text-slate-200">{LEGAL.privacyEmail}</span>.
        </p>
      </Section>

      <Section n={12} title="Changes to this Policy">
        <p>
          We may update this Policy from time to time. We will change the &ldquo;Last
          updated&rdquo; date above and, for material changes, provide additional notice
          in the app. Continued use after changes take effect means you accept the updated
          Policy.
        </p>
      </Section>
    </LegalDoc>
  );
}
