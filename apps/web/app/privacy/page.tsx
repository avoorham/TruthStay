import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — TruthStay",
  description: "How TruthStay collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-[#212121] px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-[#717182] mb-2">Last updated: April 2026</p>
      <p className="text-[#717182] text-sm mb-10">
        This policy applies to all users of the TruthStay mobile application and website (collectively, &quot;the Service&quot;).
      </p>

      {/* 1 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">1. Data Controller</h2>
        <p className="text-sm leading-relaxed mb-3">
          The data controller responsible for your personal data is:
        </p>
        <p className="text-sm leading-relaxed font-medium">TruthStay</p>
        <p className="text-sm leading-relaxed text-[#717182]">
          Email:{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline text-[#212121]">
            privacy@truth-stay.com
          </a>
          <br />
          Website: https://truth-stay.com
        </p>
        <p className="text-sm leading-relaxed mt-3">
          If you have any questions about how we handle your personal data, please contact us at the email above. We aim to respond to all privacy enquiries within 30 days.
        </p>
      </section>

      {/* 2 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">2. Personal Data We Collect</h2>
        <p className="text-sm mb-3">
          We collect the minimum data necessary to operate and improve the Service. The categories of personal data we process are:
        </p>

        <h3 className="text-base font-semibold mb-2">2.1 Data you provide directly</h3>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed mb-4">
          <li><strong>Identity data:</strong> your name and username.</li>
          <li><strong>Contact data:</strong> your email address.</li>
          <li><strong>Profile data:</strong> profile photo, bio, activity preferences (e.g. cycling, hiking), fitness level, and adventure settings.</li>
          <li><strong>Content data:</strong> trip logs, adventure itineraries, stage notes, reviews, ratings, and photos you upload.</li>
          <li><strong>Communications:</strong> messages you send to us via email or in-app feedback.</li>
        </ul>

        <h3 className="text-base font-semibold mb-2">2.2 Data collected automatically</h3>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed mb-4">
          <li><strong>Usage data:</strong> features accessed, screens viewed, and interactions within the app, collected in anonymised and aggregated form.</li>
          <li><strong>Device data:</strong> device type, operating system version, and app version, used for compatibility and crash diagnostics.</li>
          <li><strong>Authentication data:</strong> session tokens stored in a secure cookie (web) or secure device storage (mobile), used solely to maintain your logged-in state.</li>
          <li><strong>Log data:</strong> server logs including IP address, request timestamps, and response codes, retained for security and operational purposes.</li>
        </ul>

        <h3 className="text-base font-semibold mb-2">2.3 Data we do NOT collect</h3>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li>We do not collect precise real-time GPS location data.</li>
          <li>We do not collect payment card details (no payments are currently processed).</li>
          <li>We do not collect sensitive personal data such as health information, biometric data, racial or ethnic origin, political opinions, or religious beliefs.</li>
          <li>We do not collect data from children under 13 years of age.</li>
        </ul>
      </section>

      {/* 3 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">3. Legal Basis for Processing</h2>
        <p className="text-sm mb-3">
          Under the UK GDPR and EU GDPR, we must have a lawful basis to process your personal data. We rely on the following bases:
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Purpose</th>
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Legal Basis</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Creating and managing your account", "Performance of a contract (Art. 6(1)(b))"],
                ["Generating personalised adventure itineraries", "Performance of a contract (Art. 6(1)(b))"],
                ["Saving and displaying your trips and history", "Performance of a contract (Art. 6(1)(b))"],
                ["Sending essential service notifications", "Performance of a contract (Art. 6(1)(b))"],
                ["Detecting and preventing fraud or abuse", "Legitimate interests (Art. 6(1)(f))"],
                ["Security monitoring and server logs", "Legitimate interests (Art. 6(1)(f))"],
                ["Improving the Service via anonymised analytics", "Legitimate interests (Art. 6(1)(f))"],
                ["Complying with legal obligations", "Legal obligation (Art. 6(1)(c))"],
              ].map(([purpose, basis], i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-[#fafafa]"}>
                  <td className="p-3 border border-[#e0e0e0] leading-relaxed">{purpose}</td>
                  <td className="p-3 border border-[#e0e0e0] leading-relaxed">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed mt-3">
          Where we rely on legitimate interests, we have assessed that our interests are not overridden by your rights and freedoms. You have the right to object to processing based on legitimate interests — see Section 8.
        </p>
      </section>

      {/* 4 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">4. How We Use Your Data</h2>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li>To register you as a user and manage your account.</li>
          <li>To generate AI-powered adventure itineraries personalised to your preferences.</li>
          <li>To store and display your trips, stages, and history.</li>
          <li>To allow you to review and rate places and routes.</li>
          <li>To send transactional emails (e.g. account confirmation, password reset).</li>
          <li>To diagnose technical issues and maintain the security and integrity of the Service.</li>
          <li>To comply with legal obligations and respond to lawful requests from authorities.</li>
        </ul>
        <p className="text-sm leading-relaxed mt-3 font-medium">
          We do not use your personal data for advertising. We do not sell, rent, or trade your personal data to any third party. We do not build advertising profiles from your data.
        </p>
      </section>

      {/* 5 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">5. AI-Generated Content and Third-Party AI Processing</h2>
        <p className="text-sm leading-relaxed mb-3">
          TruthStay uses the Anthropic Claude API to generate adventure itineraries. When you request an adventure, your activity preferences, fitness level, location region, duration, and trip parameters are transmitted to Anthropic&apos;s servers to produce the itinerary.
        </p>
        <p className="text-sm leading-relaxed mb-3">
          We do not transmit your name, email address, or any directly identifying information to Anthropic. Anthropic processes this data as a data processor acting on our instructions and under appropriate data processing agreements. Anthropic&apos;s own privacy practices are described in their{" "}
          <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            Privacy Policy
          </a>
          .
        </p>
        <p className="text-sm leading-relaxed">
          AI-generated itineraries are stored in our database linked to your account. You may delete them at any time from within the app or by requesting account deletion.
        </p>
      </section>

      {/* 6 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">6. Data Sharing and Third-Party Processors</h2>
        <p className="text-sm mb-3">
          We share your data only with the following third-party service providers (&quot;data processors&quot;) who act under our instructions and are bound by appropriate data processing agreements:
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Processor</th>
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Purpose</th>
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Data transferred</th>
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Location</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Supabase", "Database, authentication, file storage", "All account and trip data", "EU (AWS)"],
                ["Anthropic", "AI itinerary generation", "Anonymised trip parameters", "USA (SCCs)"],
                ["Mapbox", "Map rendering and route display", "Map tile requests (no personal data)", "USA (SCCs)"],
                ["Vercel", "Web application hosting", "Web request logs, IP addresses", "USA/EU (SCCs)"],
                ["Expo / EAS", "Mobile app build and OTA updates", "App build metadata", "USA (SCCs)"],
              ].map(([proc, purpose, data, loc], i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-[#fafafa]"}>
                  <td className="p-3 border border-[#e0e0e0] font-medium">{proc}</td>
                  <td className="p-3 border border-[#e0e0e0] leading-relaxed">{purpose}</td>
                  <td className="p-3 border border-[#e0e0e0] leading-relaxed">{data}</td>
                  <td className="p-3 border border-[#e0e0e0]">{loc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed mt-3">
          SCCs = Standard Contractual Clauses approved by the European Commission for transfers outside the EEA. No other third parties receive your personal data. We do not share data with advertisers, data brokers, analytics resellers, or government authorities except where required by law.
        </p>
      </section>

      {/* 7 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">7. International Data Transfers</h2>
        <p className="text-sm leading-relaxed mb-3">
          TruthStay is based in Europe and stores your primary data on EU-based infrastructure (Supabase on AWS EU). Some of our third-party processors (Anthropic, Mapbox, Vercel, Expo) are based in the United States. When we transfer data outside the UK or EEA, we ensure appropriate safeguards are in place, including:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li>Standard Contractual Clauses (SCCs) approved by the European Commission.</li>
          <li>UK International Data Transfer Agreements (IDTAs) where applicable.</li>
          <li>Transfer Impact Assessments conducted where required.</li>
        </ul>
      </section>

      {/* 8 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">8. Data Retention</h2>
        <p className="text-sm mb-3">We retain your personal data only for as long as necessary for the purposes described in this policy:</p>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Data type</th>
                <th className="text-left p-3 font-semibold border border-[#e0e0e0]">Retention period</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Account and profile data", "Until account deletion, then deleted within 30 days"],
                ["Trip and itinerary data", "Until account deletion or manual deletion by user"],
                ["Uploaded photos", "Until account deletion or manual deletion by user"],
                ["Reviews and ratings", "Anonymised versions may be retained after account deletion"],
                ["Server access logs (IP, timestamps)", "90 days"],
                ["Database backups", "Purged within 90 days of account deletion"],
                ["Communications (support emails)", "3 years from last contact, then deleted"],
              ].map(([type, period], i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-[#fafafa]"}>
                  <td className="p-3 border border-[#e0e0e0] leading-relaxed">{type}</td>
                  <td className="p-3 border border-[#e0e0e0] leading-relaxed">{period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed mt-3">
          Aggregated, anonymised data (such as average ratings across locations) does not constitute personal data and may be retained indefinitely as it cannot be linked back to any individual.
        </p>
      </section>

      {/* 9 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">9. Your Rights</h2>
        <p className="text-sm mb-3">
          Under the UK GDPR and EU GDPR, you have the following rights in relation to your personal data:
        </p>
        <ul className="list-disc list-inside space-y-3 text-sm leading-relaxed mb-4">
          <li>
            <strong>Right of access (Art. 15):</strong> You may request a copy of the personal data we hold about you.
          </li>
          <li>
            <strong>Right to rectification (Art. 16):</strong> You may ask us to correct inaccurate or incomplete data.
          </li>
          <li>
            <strong>Right to erasure (Art. 17):</strong> You may request deletion of your personal data. You can do this directly in the app (<em>Profile → Settings → Delete Account</em>) or by contacting us.
          </li>
          <li>
            <strong>Right to restriction (Art. 18):</strong> You may ask us to pause processing of your data in certain circumstances (e.g. while a rectification request is resolved).
          </li>
          <li>
            <strong>Right to data portability (Art. 20):</strong> You may request your data in a structured, commonly used, machine-readable format (JSON or CSV).
          </li>
          <li>
            <strong>Right to object (Art. 21):</strong> You may object to processing based on our legitimate interests. We will cease processing unless we can demonstrate compelling legitimate grounds that override your interests.
          </li>
          <li>
            <strong>Rights related to automated decision-making (Art. 22):</strong> We do not make solely automated decisions that produce legal or similarly significant effects on you. AI-generated itineraries are suggestions only — no automated decisions affect your rights or access to the Service.
          </li>
          <li>
            <strong>Right to withdraw consent:</strong> Where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of prior processing.
          </li>
        </ul>
        <p className="text-sm leading-relaxed">
          To exercise any of these rights, email{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline">
            privacy@truth-stay.com
          </a>{" "}
          with your name and a description of your request. We will respond within <strong>30 days</strong>. We may ask you to verify your identity before processing your request.
        </p>
      </section>

      {/* 10 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">10. Account Deletion</h2>
        <p className="text-sm leading-relaxed mb-3">
          You can delete your account at any time using either method:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm leading-relaxed mb-3">
          <li>
            <strong>In the app:</strong> Go to <em>Profile → Settings → Delete Account</em> and confirm. Your account is deleted immediately.
          </li>
          <li>
            <strong>By email:</strong> Send a request to{" "}
            <a href="mailto:privacy@truth-stay.com" className="underline">
              privacy@truth-stay.com
            </a>{" "}
            from your registered email address. Include your full name. We will action the request within 30 days.
          </li>
        </ol>
        <p className="text-sm leading-relaxed">
          Upon deletion, all personal data is permanently removed from our live systems within 30 days and from encrypted backups within 90 days. Aggregated, anonymised data (e.g. average trail ratings) may be retained as it cannot be attributed to any individual. For full details, see our{" "}
          <a href="/delete-account" className="underline">account deletion page</a>.
        </p>
      </section>

      {/* 11 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">11. Security</h2>
        <p className="text-sm leading-relaxed mb-3">
          We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, destruction, or alteration, including:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li>Encryption of data in transit using TLS 1.2 or higher.</li>
          <li>Encryption of data at rest on our database infrastructure.</li>
          <li>Row-level security (RLS) policies on all database tables, ensuring users can only access their own data.</li>
          <li>Authentication using industry-standard token-based sessions.</li>
          <li>Access to production systems restricted to authorised personnel only.</li>
          <li>Regular security reviews of application code and dependencies.</li>
        </ul>
        <p className="text-sm leading-relaxed mt-3">
          While we take all reasonable steps to protect your data, no method of transmission over the internet or electronic storage is completely secure. We cannot guarantee absolute security. In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the relevant supervisory authority within 72 hours and affected users without undue delay where required by law.
        </p>
      </section>

      {/* 12 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">12. Cookies and Tracking</h2>
        <p className="text-sm leading-relaxed mb-3">
          <strong>Web app:</strong> We use a single, strictly necessary session cookie to maintain your authenticated state. This cookie is set only after you log in, is encrypted, and expires when you log out or the session ends. We do not use advertising cookies, tracking pixels, or any third-party analytics scripts on our website.
        </p>
        <p className="text-sm leading-relaxed">
          <strong>Mobile app:</strong> The TruthStay mobile app does not use cookies. Authentication state is managed using secure device storage (Expo SecureStore).
        </p>
      </section>

      {/* 13 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">13. Children&apos;s Privacy</h2>
        <p className="text-sm leading-relaxed">
          The Service is not directed at children under the age of 13 (or 16 where required by local law). We do not knowingly collect personal data from children. If you are a parent or guardian and believe your child has provided us with personal data without your consent, please contact us at{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline">
            privacy@truth-stay.com
          </a>{" "}
          and we will delete the data promptly. If we become aware that we have collected data from a child without appropriate consent, we will take steps to delete it immediately.
        </p>
      </section>

      {/* 14 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">14. Third-Party Links</h2>
        <p className="text-sm leading-relaxed">
          The Service may contain links to third-party websites or services (such as route providers, mapping tools, or accommodation sites). This Privacy Policy does not apply to those external sites. We are not responsible for the privacy practices of third parties. We encourage you to review the privacy policy of any third-party site you visit.
        </p>
      </section>

      {/* 15 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">15. Changes to This Policy</h2>
        <p className="text-sm leading-relaxed">
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top of this page indicates when the policy was last revised. For material changes — such as new categories of data collected, new purposes, or new third-party processors — we will notify you via in-app notification or email at least 14 days before the change takes effect. Continued use of the Service after the effective date constitutes acceptance of the revised policy. If you do not agree to the updated policy, you may delete your account before the effective date.
        </p>
      </section>

      {/* 16 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">16. Complaints</h2>
        <p className="text-sm leading-relaxed mb-3">
          If you believe we have not handled your personal data in accordance with this policy or applicable data protection law, please contact us first at{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline">
            privacy@truth-stay.com
          </a>
          . We will investigate and respond within 30 days.
        </p>
        <p className="text-sm leading-relaxed">
          If you are not satisfied with our response, you have the right to lodge a complaint with your local data protection authority. In the UK, this is the Information Commissioner&apos;s Office (ICO):{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="underline">
            ico.org.uk
          </a>
          , telephone 0303 123 1113. In the EU, contact your national supervisory authority listed at{" "}
          <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" className="underline">
            edpb.europa.eu
          </a>
          .
        </p>
      </section>

      {/* 17 */}
      <section>
        <h2 className="text-xl font-bold mb-3">17. Contact Us</h2>
        <p className="text-sm leading-relaxed">
          For any privacy-related questions, data subject requests, or concerns, contact us at:
        </p>
        <p className="text-sm leading-relaxed mt-3 font-medium">TruthStay</p>
        <p className="text-sm leading-relaxed text-[#717182]">
          Email:{" "}
          <a href="mailto:privacy@truth-stay.com" className="underline text-[#212121]">
            privacy@truth-stay.com
          </a>
        </p>
      </section>
    </div>
  );
}
