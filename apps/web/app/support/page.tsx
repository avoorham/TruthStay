import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — TruthStay",
  description: "Get help with TruthStay. Find answers to common questions or contact us directly.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white text-[#212121] px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Support</h1>
      <p className="text-[#717182] mb-10 text-sm">
        Need help? Browse common questions below or contact us directly.
      </p>

      {/* Contact */}
      <section className="mb-10 p-5 bg-[#f5f5f5] rounded-xl">
        <h2 className="text-base font-semibold mb-1">Contact us</h2>
        <p className="text-sm text-[#717182] mb-2">
          We aim to respond to all enquiries within 2 business days.
        </p>
        <a
          href="mailto:support@truth-stay.com"
          className="text-sm font-medium underline text-[#212121]"
        >
          support@truth-stay.com
        </a>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-6">Frequently asked questions</h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-base font-semibold mb-2">How do I create an adventure?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              Open the app and tap the <strong>Discover</strong> tab (the sparkle icon in the centre of the navigation bar). Type what kind of adventure you&apos;re looking for — for example, &quot;3-day cycling route in Mallorca&quot; — and the AI will generate a full itinerary for you.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">How do I share a trip with friends?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              Open any trip itinerary, tap the person icon in the top-right corner, and select <strong>Share trip itinerary</strong>. You can invite friends by username or email, copy a link, or share a QR code. Friends can be assigned Owner, Editor, or Viewer roles.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">Can I use TruthStay offline?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              The app requires an internet connection to generate itineraries and load maps. Once a trip is loaded, basic itinerary content (stop names, distances, notes) remains accessible. Full map and AI features require a connection.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">How do I delete my account?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              Go to <strong>Profile → Settings → Delete Account</strong> and confirm. Your account and all associated data will be permanently deleted immediately. Alternatively, email{" "}
              <a href="mailto:support@truth-stay.com" className="underline text-[#212121]">
                support@truth-stay.com
              </a>{" "}
              from your registered email address and we will action the request within 30 days. See our{" "}
              <a href="/delete-account" className="underline text-[#212121]">
                account deletion page
              </a>{" "}
              for full details.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">I forgot my password. How do I reset it?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              On the sign-in screen, tap <strong>Forgot password?</strong> and enter your email address. You&apos;ll receive a reset link within a few minutes. Check your spam folder if it doesn&apos;t arrive.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">How do I report incorrect or harmful content?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              Email{" "}
              <a href="mailto:support@truth-stay.com" className="underline text-[#212121]">
                support@truth-stay.com
              </a>{" "}
              with a description of the content and, if possible, a screenshot. We review all reports promptly.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">Is TruthStay free?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              Yes, TruthStay is free to download and use. Core features including adventure discovery, itinerary planning, and trip sharing are available at no cost.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2">How do I update my username or display name?</h3>
            <p className="text-sm text-[#717182] leading-relaxed">
              Go to <strong>Profile</strong> and tap the pencil (edit) icon. You can update your display name and username from the Edit Profile sheet.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Privacy &amp; data</h2>
        <p className="text-sm text-[#717182] leading-relaxed">
          For questions about how we handle your personal data, see our{" "}
          <a href="/privacy" className="underline text-[#212121]">
            Privacy Policy
          </a>
          . To submit a data access, correction, or deletion request, email{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline text-[#212121]">
            privacy@truth-stay.com
          </a>
          .
        </p>
      </section>

      {/* Footer contact */}
      <section>
        <h2 className="text-xl font-bold mb-3">Still need help?</h2>
        <p className="text-sm text-[#717182] leading-relaxed">
          Email us at{" "}
          <a href="mailto:support@truth-stay.com" className="underline text-[#212121]">
            support@truth-stay.com
          </a>{" "}
          and we&apos;ll get back to you within 2 business days.
        </p>
      </section>
    </div>
  );
}
