import type { Metadata } from "next";
import { LegalDoc, Section, Bullets } from "@/src/components/legal/LegalDoc";
import { LEGAL } from "@/src/components/legal/legalConfig";

export const metadata: Metadata = {
  title: "Terms of Service · Streakr",
  description: "The rules for using Streakr.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      intro={
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you and{" "}
          {LEGAL.operator} (&ldquo;{LEGAL.appName},&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
          governing your use of the {LEGAL.appName} web app and related services (the
          &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to
          these Terms and to our{" "}
          <a href="/privacy" className="text-[#FF4E00] hover:underline">Privacy Policy</a>.
          If you do not agree, do not use the Service.
        </p>
      }
    >
      <Section n={1} title="Eligibility">
        <p>
          You must be at least {LEGAL.minAge} years old and have the legal capacity to enter
          this agreement. If you are under the age of majority where you live, you may use the
          Service only with the involvement of a parent or guardian. You are responsible for
          ensuring your use of the Service is lawful in your location.
        </p>
      </Section>

      <Section n={2} title="Your account & wallet">
        <Bullets
          items={[
            "You sign in through our authentication provider (Privy), which may create a Solana wallet that serves as your account identity.",
            "You are responsible for maintaining the security of your login method and for all activity under your account.",
            "Provide accurate information and keep it current. One account per person; do not share, sell, or transfer accounts.",
            "We may use sponsored (gas-less) blockchain transactions on your behalf to operate the Service.",
          ]}
        />
      </Section>

      <Section n={3} title="The game">
        <p>
          {LEGAL.appName} is a free-to-play prediction game: you pick outcomes of football
          matches to build streaks, earn points, badges, and leaderboard positions. Picks
          lock at kick-off and cannot be changed afterwards. Match data is provided by
          third parties and may contain errors or delays; we are not liable for the accuracy,
          completeness, or timeliness of sports data, and we may correct results or streaks to
          reflect official or corrected outcomes.
        </p>
      </Section>

      <Section n={4} title="Free to play — no prizes">
        <p>
          {LEGAL.appName} is completely free to play. You compete only for streaks, points,
          badges, and leaderboard standing. These are virtual, have no monetary value, and
          cannot be redeemed, transferred, or exchanged for cash or anything of value.
        </p>
        <p>
          {LEGAL.appName} does not offer cash prizes, paid entry, wagering, or betting, and it
          is not a gambling or money-transmission service. It is a game of skill and prediction
          offered purely for entertainment.
        </p>
      </Section>

      <Section n={5} title="Acceptable use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            "Cheat, exploit bugs, use bots/automation, create multiple or fake accounts, or otherwise manipulate streaks, picks, leaderboards, or prizes.",
            "Access the Service by unauthorised means, probe or breach security, or disrupt or overload our systems or providers.",
            "Reverse engineer, scrape, or copy the Service except as permitted by law.",
            "Use the Service for anything unlawful, fraudulent, or infringing.",
          ]}
        />
      </Section>

      <Section n={6} title="User content & community">
        <p>
          The Service may let you create a username, avatar, group names, and (as features
          roll out) posts, comments, or reactions (&ldquo;User Content&rdquo;). You retain
          ownership of your User Content and grant us a worldwide, non-exclusive, royalty-free
          licence to host, display, and distribute it to operate the Service. You are
          responsible for your User Content and must not post anything that is unlawful,
          hateful, harassing, obscene, deceptive, infringing, or otherwise objectionable. We
          may moderate, remove, or restrict User Content and suspend accounts that violate
          these Terms, at our discretion.
        </p>
      </Section>

      <Section n={7} title="Intellectual property">
        <p>
          The Service, including its software, design, branding, and content (excluding User
          Content and third-party data), is owned by {LEGAL.operator} or its licensors and
          protected by intellectual-property laws. We grant you a limited, personal,
          non-transferable, revocable licence to use the Service for its intended purpose. All
          rights not expressly granted are reserved.
        </p>
      </Section>

      <Section n={8} title="Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
          warranties of any kind, whether express or implied, including merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant that the
          Service will be uninterrupted, error-free, or secure, or that sports data will be
          accurate. Nothing in the Service is financial, legal, or professional advice.
        </p>
      </Section>

      <Section n={9} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, {LEGAL.operator} and its officers,
          employees, and providers will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for loss of profits, data, goodwill, or
          streaks/points, arising from your use of the Service. Because the Service is free,
          our total liability for any claim relating to the Service will not exceed USD 100.
          Some jurisdictions do not allow certain limitations, so some of the above may not
          apply to you.
        </p>
      </Section>

      <Section n={10} title="Indemnity">
        <p>
          You agree to indemnify and hold harmless {LEGAL.operator} and its providers from any
          claims, damages, and expenses (including reasonable legal fees) arising from your use
          of the Service, your User Content, or your breach of these Terms or applicable law.
        </p>
      </Section>

      <Section n={11} title="Suspension & termination">
        <p>
          You may stop using the Service and delete your account at any time, from Profile →
          Settings → Delete Account. We may suspend or terminate your access or remove content
          if we reasonably believe you have violated these Terms or applicable law, or to
          protect the Service or other users. Sections that by their nature should survive
          termination (e.g. 7–10) will survive.
        </p>
      </Section>

      <Section n={12} title="Changes to the Service & Terms">
        <p>
          We may modify or discontinue features at any time. We may also update these Terms;
          we will update the &ldquo;Last updated&rdquo; date and, for material changes, provide
          notice in the app. Continued use after changes take effect means you accept the
          updated Terms.
        </p>
      </Section>

      <Section n={13} title="Governing law & disputes">
        <p>
          These Terms are governed by the laws of {LEGAL.governingLaw}, without regard to
          conflict-of-laws rules, and the courts of {LEGAL.governingLaw} will have jurisdiction,
          except where mandatory local law gives you the right to bring proceedings elsewhere.
        </p>
      </Section>

      <Section n={14} title="Contact">
        <p>
          Questions about these Terms? Contact{" "}
          <span className="text-slate-200">{LEGAL.contactEmail}</span>.
        </p>
      </Section>
    </LegalDoc>
  );
}
