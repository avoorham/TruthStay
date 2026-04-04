import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account — TruthStay",
  description: "Request deletion of your TruthStay account and associated data.",
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white text-[#212121] px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Delete Your TruthStay Account</h1>
      <p className="text-[#717182] mb-10">
        You can request deletion of your TruthStay account and all associated data at any time.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">How to delete your account</h2>
        <ol className="list-decimal list-inside space-y-3 text-sm leading-relaxed">
          <li>
            <strong>From the app:</strong> Go to <em>Profile → Settings → Delete Account</em> and confirm your request. Your account will be deleted immediately.
          </li>
          <li>
            <strong>By email:</strong> Send a deletion request to{" "}
            <a href="mailto:privacy@truth-stay.com" className="underline">
              privacy@truth-stay.com
            </a>{" "}
            from the email address associated with your account. Include your full name and the email address used to sign up. We will process your request within 30 days.
          </li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">What data is deleted</h2>
        <p className="text-sm mb-3">When your account is deleted, the following data is permanently removed:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Your profile (name, email address, avatar)</li>
          <li>Your adventure preferences and settings</li>
          <li>Your saved and generated adventure itineraries</li>
          <li>Your trip logs and stage data</li>
          <li>Your reviews and ratings of places and routes</li>
          <li>Photos you have uploaded</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Data retention</h2>
        <p className="text-sm leading-relaxed">
          All personal data is deleted within <strong>30 days</strong> of a confirmed deletion request. Anonymised, aggregated data (e.g. average ratings) may be retained as it cannot be linked back to you. Backups are purged within 90 days.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">Questions</h2>
        <p className="text-sm leading-relaxed">
          If you have any questions about your data, contact us at{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline">
            privacy@truth-stay.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
