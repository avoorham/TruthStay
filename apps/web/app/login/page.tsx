import { login } from "../auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>TruthStay</h1>
        <p style={styles.tagline}>Sign in to your account</p>

        {error && <p style={styles.error}>{decodeURIComponent(error)}</p>}

        <form action={login} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </label>
          <button type="submit" style={styles.button}>
            Sign in
          </button>
        </form>

        <p style={styles.footer}>
          No account?{" "}
          <a href="/signup" style={styles.link}>
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f9f9f9",
    fontFamily: "var(--font-geist-sans)",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  logo: { fontSize: "1.8rem", fontWeight: 700, margin: "0 0 0.25rem" },
  tagline: { color: "#666", margin: "0 0 1.5rem", fontSize: "0.95rem" },
  error: {
    background: "#fff0f0",
    color: "#c00",
    borderRadius: "6px",
    padding: "0.6rem 0.8rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  input: {
    padding: "0.6rem 0.75rem",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "1rem",
    outline: "none",
  },
  button: {
    marginTop: "0.5rem",
    padding: "0.75rem",
    borderRadius: "6px",
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  footer: { marginTop: "1.25rem", textAlign: "center", fontSize: "0.875rem", color: "#666" },
  link: { color: "#111", fontWeight: 600 },
};
