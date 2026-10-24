import { CircleCheck } from "lucide-react";

import { PageHeader } from "@/components/lexora/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { cn } from "@/lib/utils";

import { EmailVerification } from "./email-verification";
import { LearnerProfileForm, NameForm } from "./settings-forms";
import { SignOutButton } from "./sign-out-button";

/** Title and one line of context directly above the section's controls. */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-5 py-10 first:pt-0 last:pb-0">
      <div className="space-y-1">
        {/* scroll-mt clears the sticky top bar when Home links to #account-title. */}
        <h2 id={id} className="scroll-mt-20 type-heading text-foreground">
          {title}
        </h2>
        <p className="max-w-prose type-body text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Where the email stands, as a pill (DESIGN.md §9.6): text and icon, never colour alone. */
function VerificationBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 type-micro whitespace-nowrap",
        verified ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {verified ? (
        <CircleCheck aria-hidden className="size-3" />
      ) : (
        <span aria-hidden className="size-1.5 rounded-full bg-subtle-foreground" />
      )}
      {verified ? "Verified" : "Not verified"}
    </span>
  );
}

function AccountRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-3 sm:gap-4">
      <dt className="type-label text-muted-foreground">{term}</dt>
      <dd className="min-w-0 sm:col-span-2">{children}</dd>
    </div>
  );
}

type SettingsViewProps = {
  user: { name: string; email: string; emailVerified: boolean; createdAt: Date };
  profile: { targetBand: string | null; testDate: string | null; focusSkill: string | null } | null;
};

export function SettingsView({ user, profile }: SettingsViewProps) {
  const memberSince = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    user.createdAt,
  );

  return (
    <PageContainer>
      {/* An inner column: PageContainer's max-w-page would win over a max-w passed to it. */}
      <div className="max-w-3xl">
        <PageHeader
          title="Settings"
          description="Manage your profile, learning goals and account."
        />

        <div className="mt-10 divide-y divide-border">
          <Section id="profile-title" title="Profile" description="How Lexora addresses you.">
            <NameForm name={user.name} />
          </Section>

          <Section
            id="learning-title"
            title="Learning goals"
            description="Set the goals Lexora will use to personalise your practice. Nothing uses them yet; later updates will."
          >
            <LearnerProfileForm
              targetBand={profile?.targetBand ?? null}
              testDate={profile?.testDate ?? null}
              focusSkill={profile?.focusSkill ?? null}
            />
          </Section>

          <Section id="account-title" title="Account" description="Your sign-in details.">
            <dl className="divide-y divide-border-subtle border-y border-border-subtle">
              <AccountRow term="Email">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 type-body wrap-break-word text-foreground">
                    {user.email}
                  </span>
                  <VerificationBadge verified={user.emailVerified} />
                </div>
              </AccountRow>
              <AccountRow term="Member since">
                <span className="type-body text-foreground">{memberSince}</span>
              </AccountRow>
            </dl>
            {user.emailVerified ? null : <EmailVerification email={user.email} />}
            <SignOutButton />
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
