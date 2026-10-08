"use client";

import { BookMarked } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { SaveTarget } from "./saved-language";

export type SaveGateRequest = SaveTarget & { returnTo: string };

function withNext(path: "/sign-up" | "/sign-in", returnTo: string) {
  return `${path}?next=${encodeURIComponent(returnTo)}`;
}

/**
 * Shown when a visitor tries to save. Explains what an account adds, then sends them to sign up
 * or sign in with the current page as the return path. The save completes when they come back.
 */
export function SaveGateDialog({
  request,
  onOpenChange,
  onContinue,
}: {
  request: SaveGateRequest | null;
  onOpenChange: (open: boolean) => void;
  onContinue: (target: SaveTarget) => void;
}) {
  const term = request?.label;
  const target: SaveTarget | null = request
    ? { senseId: request.senseId, label: request.label }
    : null;

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <span className="mb-1 flex size-9 items-center justify-center rounded-md bg-muted text-ink">
            <BookMarked aria-hidden className="size-4.5" />
          </span>
          <DialogTitle className="type-heading text-foreground">
            Save this to your Language Bank
          </DialogTitle>
          <DialogDescription className="type-body text-muted-foreground">
            Create a free Lexora account to save language, practise it later, and track your
            progress.
          </DialogDescription>
        </DialogHeader>
        {term ? (
          <p className="rounded-md bg-muted px-4 py-3">
            <span className="block type-overline text-subtle-foreground">You’re saving</span>
            <span className="mt-1 block type-term-sm text-foreground">{term}</span>
          </p>
        ) : null}
        <p className="type-caption text-subtle-foreground">
          You’ll come straight back to this page, and it will be saved for you.
        </p>
        {request && target ? (
          <DialogFooter>
            <Button asChild variant="outline">
              <Link
                href={withNext("/sign-in", request.returnTo)}
                onClick={() => onContinue(target)}
              >
                Sign in
              </Link>
            </Button>
            <Button asChild>
              <Link
                href={withNext("/sign-up", request.returnTo)}
                onClick={() => onContinue(target)}
              >
                Create free account
              </Link>
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
