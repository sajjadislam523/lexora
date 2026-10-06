"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
        } finally {
          router.replace("/sign-in?reason=signed-out");
          router.refresh();
        }
      }}
    >
      {pending ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      ) : (
        <LogOut data-icon="inline-start" />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
