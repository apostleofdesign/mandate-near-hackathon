// Who built this — a plain contact page so a judge (or anyone else) can find
// the person behind the repo, not just the code. Static, no contract calls.
import { RiUser3Line, RiTwitterXLine, RiLinkedinBoxLine, RiMailLine, RiGithubLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const LINKS = [
  {
    icon: RiTwitterXLine,
    label: "@apostleofdesign",
    sub: "X / Twitter",
    href: "https://x.com/apostleofdesign",
  },
  {
    icon: RiLinkedinBoxLine,
    label: "apostleofdesign",
    sub: "LinkedIn",
    href: "https://linkedin.com/in/apostleofdesign",
  },
  {
    icon: RiMailLine,
    label: "dannyamarachukwu@gmail.com",
    sub: "Email",
    href: "mailto:dannyamarachukwu@gmail.com",
  },
  {
    icon: RiGithubLine,
    label: "apostleofdesign/mandate-near-hackathon",
    sub: "Source",
    href: "https://github.com/apostleofdesign/mandate-near-hackathon",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiUser3Line className="size-3.5" />
          Builder
        </Badge>
        <h1 className="font-heading text-3xl font-medium tracking-tight">About</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Mandate was built by Danny Amara (apostleofdesign) for the NEAR Build Beyond Boundaries
          hackathon — contracts and scaffolding pair-programmed with Claude Code, direction and every
          design decision his own. Reach out on any of these.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <link.icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{link.label}</span>
                  <span className="text-xs text-muted-foreground">{link.sub}</span>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </main>
  );
}
