export const metadata = {
  title: "Mandate — NEAR HACKATHON",
  description: "Policy-governed agent marketplace on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
