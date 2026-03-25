export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-geist-sans)",
        padding: "2rem",
        gap: "1.5rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>
        TruthStay
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#666",
          maxWidth: "540px",
          margin: 0,
        }}
      >
        Honest active holiday reviews from people you trust — cycling routes,
        hiking trails, places to stay, and where to eat.
      </p>
      <p style={{ fontSize: "0.9rem", color: "#999", margin: 0 }}>
        Coming soon — scaffold is running.
      </p>
    </main>
  );
}
