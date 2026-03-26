import { redirect } from "next/navigation";
import { logout } from "../auth/actions";
import { createClient } from "../../lib/supabase/server";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>TruthStay</span>
        <form action={logout}>
          <button type="submit" style={styles.signOut}>
            Sign out
          </button>
        </form>
      </header>
      <div style={styles.content}>
        <h2 style={styles.heading}>Welcome back 👋</h2>
        <p style={styles.sub}>
          You&apos;re signed in as <strong>{user.email}</strong>
        </p>
        <p style={styles.sub}>Your feed is coming soon.</p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", fontFamily: "var(--font-geist-sans)", background: "#f9f9f9" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 2rem",
    background: "#fff",
    borderBottom: "1px solid #eee",
  },
  logo: { fontWeight: 700, fontSize: "1.2rem" },
  signOut: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "0.4rem 0.8rem",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  content: {
    maxWidth: "600px",
    margin: "4rem auto",
    padding: "0 1rem",
  },
  heading: { fontSize: "1.8rem", fontWeight: 700, margin: "0 0 0.5rem" },
  sub: { color: "#666", margin: "0.25rem 0" },
};
