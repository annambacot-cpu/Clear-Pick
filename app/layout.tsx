import type { Metadata } from "next";
import "./globals.css";

const [githubOwner = "", githubRepository = ""] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const githubBase = githubOwner
  ? `https://${githubOwner}.github.io${githubRepository.endsWith(".github.io") ? "" : `/${githubRepository}`}`
  : "http://localhost:3000";
const title = "ClearPick — Train Your Sports Decisions";
const description = "Make simulated sports predictions, measure your decision process, and discover the patterns behind your picks—without risking money.";

export const metadata: Metadata = {
  metadataBase: new URL(githubBase),
  title,
  description,
  icons: { icon: "./favicon.svg", shortcut: "./favicon.svg" },
  openGraph: { title, description, type: "website", images: [{ url: `${githubBase}/og.png`, width: 1200, height: 630, alt: "ClearPick decision-training preview" }] },
  twitter: { card: "summary_large_image", title, description, images: [`${githubBase}/og.png`] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
