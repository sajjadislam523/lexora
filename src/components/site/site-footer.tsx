import Link from "next/link";

import { Logo } from "./logo";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/sign-up", label: "Create an account" },
  { href: "/design-system", label: "Design system" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sidebar">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-10">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs type-caption text-muted-foreground">
            Find the English you mean. Use it naturally. Remember it when it matters.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-xs type-caption text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
