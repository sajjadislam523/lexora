import { PageHeader } from "@/components/lexora/page-header";
import { PageContainer } from "@/components/shell/page-container";

import { LearnerProfileForm, NameForm } from "./settings-forms";
import { SignOutButton } from "./sign-out-button";

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
    <section
      aria-labelledby={id}
      className="grid gap-6 border-t border-border py-8 lg:grid-cols-3 lg:gap-10"
    >
      <div className="space-y-1">
        <h2 id={id} className="type-subheading text-foreground">
          {title}
        </h2>
        <p className="type-body text-muted-foreground">{description}</p>
      </div>
      <div className="lg:col-span-2">{children}</div>
    </section>
  );
}

type SettingsViewProps = {
  user: { name: string; email: string; createdAt: Date };
  profile: { targetBand: string | null; testDate: string | null; focusSkill: string | null } | null;
};

export function SettingsView({ user, profile }: SettingsViewProps) {
  const memberSince = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    user.createdAt,
  );

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        description="Your profile and what you’re preparing for."
        className="pb-8"
      />

      <Section id="profile-title" title="Profile" description="How Lexora addresses you.">
        <NameForm name={user.name} />
      </Section>

      <Section
        id="learning-title"
        title="Learning profile"
        description="What you’re aiming for. Later phases use this to pace practice and suggest language."
      >
        <LearnerProfileForm
          targetBand={profile?.targetBand ?? null}
          testDate={profile?.testDate ?? null}
          focusSkill={profile?.focusSkill ?? null}
        />
      </Section>

      <Section id="account-title" title="Account" description="Sign-in details.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="type-overline text-subtle-foreground">Email</dt>
            <dd className="type-body text-foreground">{user.email}</dd>
          </div>
          <div className="space-y-1">
            <dt className="type-overline text-subtle-foreground">Member since</dt>
            <dd className="type-body text-foreground">{memberSince}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </Section>
    </PageContainer>
  );
}
