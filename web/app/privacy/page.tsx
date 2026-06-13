export const metadata = { title: 'Privacy Policy — FROM' }

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 80px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#2C1206', lineHeight: 1.7 }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 38, fontWeight: 500, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#9B7060', fontSize: 13, marginBottom: 40 }}>Last updated: June 2026</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>1. What we collect</h2>
      <p><strong>Account data:</strong> Your email address when you sign up.<br />
      <strong>Usage data:</strong> Search queries, products you save or interact with, and your style preferences — used to personalise your experience.<br />
      <strong>Device data:</strong> Browser type, device type, and general location (country/city) for analytics.<br />
      <strong>Cookies:</strong> Session tokens to keep you signed in. No tracking cookies across other sites.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>2. How we use it</h2>
      <p>We use your data to:<br />
      — Power your personalised taste profile and wardrobe memory<br />
      — Improve search relevance and AI recommendations<br />
      — Send you transactional emails (OTP codes, price drop alerts if enabled)<br />
      — Understand how FROM is used so we can improve it</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>3. What we never do</h2>
      <p>We never sell your personal data to third parties. We never use your data for advertising targeting on other platforms. We never share your data with brands unless you explicitly contact them.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>4. Third-party services</h2>
      <p>FROM uses the following services that may process your data under their own policies:<br />
      — <strong>Convex</strong> — database hosting (US)<br />
      — <strong>Groq</strong> — AI inference (your search queries are processed by Groq; they are not stored for training)<br />
      — <strong>Google</strong> — optional sign-in, and AI inference for the Fabrics stylist and image-based search (Gemini); inputs are not stored for training<br />
      — <strong>Vercel</strong> — hosting and serverless functions</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>5. Data retention</h2>
      <p>Your account data is retained for as long as your account is active. You can delete your account and all associated data at any time by emailing us. Anonymous search signals are retained for up to 90 days.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>6. Your rights</h2>
      <p>You have the right to access, correct, or delete your personal data. If you are in the EU or UK, you also have rights under GDPR. Email us to exercise any of these rights.</p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>7. Contact</h2>
      <p>Questions about privacy? Email us at <a href="mailto:hello@from.fashion" style={{ color: '#2C1206' }}>hello@from.fashion</a></p>
    </main>
  )
}
