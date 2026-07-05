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
          ensuring your use of the Service is lawful in your location, and you may not use the
          Service if you are located in, or a resident of, a country or region subject to
          comprehensive sanctions, or if you appear on a restricted-parties list.
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
          {LEGAL.appName} is a prediction game: you pick outcomes of football matches to build
          streaks, and earn points, badges, and leaderboard positions. Picks lock at kick-off
          and cannot be changed afterwards. Match data is provided by third parties and may
          contain errors or delays; we are not liable for the accuracy, completeness, or
          timeliness of sports data, and we may correct results or streaks to reflect official
          or corrected outcomes.
        </p>
      </Section>

      <Section n={4} title="Free to play — no prizes">
        <p>
          The core {LEGAL.appName} game is free to play. You never have to pay to make picks,
          build streaks, earn points and badges, or climb the leaderboards, and there is no
          paid entry. {LEGAL.appName} does not offer cash prizes, wagering, or betting, and it
          is not a gambling or money-transmission service — it is a game of skill and
          prediction offered for entertainment.
        </p>
        <p>
          We may offer optional cosmetic items for purchase (section 5). These are purely
          decorative, are never required to play, and never affect your picks, streaks, points,
          or ranking.
        </p>
      </Section>

      <Section n={5} title="Virtual items & purchases">
        <p>
          From time to time the Service may let you buy optional virtual items — for example
          avatar cosmetics or profile decorations (&ldquo;Virtual Items&rdquo;). Where we offer
          purchases, the following apply:
        </p>
        <Bullets
          items={[
            "Prices are shown before you buy and may include applicable taxes. Payments are handled by a third-party payment processor under its own terms; we do not receive or store your full card details.",
            "You receive a limited, personal, non-transferable, revocable licence to use a Virtual Item within the Service — you do not own it. Virtual Items have no monetary value, are not currency, and cannot be sold, traded, transferred, or exchanged for cash or anything of value.",
            "Virtual Items are cosmetic only and give no competitive advantage. We do not sell randomised “loot boxes” — you always know exactly what you are buying before you pay.",
            "Because Virtual Items are digital content delivered immediately, where you have a statutory right of withdrawal (for example the EU/UK 14-day cooling-off period) you expressly request immediate delivery and acknowledge that you lose that withdrawal right once delivery begins. This does not affect any refund we are required to give for a faulty or misdescribed item under applicable consumer law.",
            "We may add, change, reprice, or discontinue Virtual Items, and may expire unused items if we discontinue the Service, subject to applicable law.",
            "You must be of the age of majority in your location, or have your parent or guardian's consent, to make a purchase. You are responsible for all purchases made through your account.",
          ]}
        />
      </Section>

      <Section n={6} title="Acceptable use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            "Cheat, exploit bugs, use bots/automation, create multiple or fake accounts, or otherwise manipulate streaks, picks, or leaderboards.",
            "Harass, threaten, bully, impersonate, or incite violence against others.",
            "Access the Service by unauthorised means, probe or breach security, or disrupt or overload our systems or providers.",
            "Reverse engineer, scrape, or copy the Service except as permitted by law.",
            "Use the Service for anything unlawful, fraudulent, or infringing.",
          ]}
        />
      </Section>

      <Section n={7} title="Community content & moderation">
        <p>
          The Service may let you create a username, avatar, and group names, and — as social
          features roll out — posts, comments, votes, reactions, and similar contributions
          (&ldquo;User Content&rdquo;). You keep ownership of your User Content and grant us a
          worldwide, non-exclusive, royalty-free, sublicensable licence to host, store,
          reproduce, display, and distribute it to operate and promote the Service.
        </p>
        <p>You must not post User Content that:</p>
        <Bullets
          items={[
            "is unlawful, defamatory, hateful, harassing, or threatening;",
            "is sexually explicit, or that exploits, sexualises, or endangers minors;",
            "infringes anyone's intellectual-property or privacy rights;",
            "is spam, a scam, malware, or a phishing attempt; or",
            "discloses another person's private information without their consent.",
          ]}
        />
        <p>
          Much of what you share — username, avatar, streaks, leaderboard rank, posts, and
          comments — is <strong className="text-slate-200">public by design</strong> and may be
          seen, copied, and re-shared by others. Do not post anything you need to keep private.
        </p>
        <p>
          You can report content or users you believe violate these Terms by contacting{" "}
          <span className="text-slate-200">{LEGAL.contactEmail}</span>. We may — but are not
          obliged to — review, moderate, label, restrict, or remove User Content, and suspend
          or terminate accounts, to enforce these Terms or comply with law. We act as a neutral
          host of User Content and are not responsible for content created by users.
        </p>
        <p>
          <strong className="text-slate-200">Intellectual-property takedowns.</strong> If you
          believe content on the Service infringes your intellectual property, send a notice to{" "}
          <span className="text-slate-200">{LEGAL.contactEmail}</span> identifying the work, the
          infringing content and where it appears, your contact details, and a statement of your
          good-faith belief. We respond to valid notices, including by removing infringing
          content and, where appropriate, terminating repeat infringers.
        </p>
      </Section>

      <Section n={8} title="Intellectual property">
        <p>
          The Service, including its software, design, branding, and content (excluding User
          Content and third-party data), is owned by {LEGAL.operator} or its licensors and
          protected by intellectual-property laws. We grant you a limited, personal,
          non-transferable, revocable licence to use the Service for its intended purpose. All
          rights not expressly granted are reserved.
        </p>
      </Section>

      <Section n={9} title="Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
          warranties of any kind, whether express or implied, including merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant that the
          Service will be uninterrupted, error-free, or secure, or that sports data will be
          accurate. Nothing in the Service is financial, legal, or professional advice.
        </p>
      </Section>

      <Section n={10} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, {LEGAL.operator} and its officers,
          employees, and providers will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for loss of profits, data, goodwill, or
          streaks/points, arising from your use of the Service. Our total liability for any
          claim relating to the Service will not exceed the greater of the total amount you
          paid us for Virtual Items in the 12 months before the claim, or USD 100. Some
          jurisdictions do not allow certain limitations, so some of the above may not apply to
          you, and nothing here limits liability that cannot be limited by law.
        </p>
      </Section>

      <Section n={11} title="Indemnity">
        <p>
          You agree to indemnify and hold harmless {LEGAL.operator} and its providers from any
          claims, damages, and expenses (including reasonable legal fees) arising from your use
          of the Service, your User Content, or your breach of these Terms or applicable law.
        </p>
      </Section>

      <Section n={12} title="Suspension & termination">
        <p>
          You may stop using the Service and delete your account at any time, from Profile →
          Settings → Delete Account. We may suspend or terminate your access or remove content
          if we reasonably believe you have violated these Terms or applicable law, or to
          protect the Service or other users. Sections that by their nature should survive
          termination (e.g. 8–11) will survive.
        </p>
      </Section>

      <Section n={13} title="Changes to the Service & Terms">
        <p>
          We may modify or discontinue features at any time. We may also update these Terms;
          we will update the &ldquo;Last updated&rdquo; date and, for material changes, provide
          notice in the app. Continued use after changes take effect means you accept the
          updated Terms.
        </p>
      </Section>

      <Section n={14} title="Governing law & disputes">
        <p>
          These Terms are governed by the laws of {LEGAL.governingLaw}, without regard to
          conflict-of-laws rules, and the courts of {LEGAL.governingLaw} will have jurisdiction,
          except where mandatory local law gives you the right to bring proceedings elsewhere.
          Nothing in these Terms removes mandatory consumer-protection rights you have under the
          law of your country of residence.
        </p>
      </Section>

      <Section n={15} title="Contact">
        <p>
          Questions about these Terms? Contact{" "}
          <span className="text-slate-200">{LEGAL.contactEmail}</span>.
        </p>
      </Section>
    </LegalDoc>
  );
}
