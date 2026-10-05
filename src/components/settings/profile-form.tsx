"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import { dispatchProfileNameChanged } from "@/lib/profile/name-client";
import { ProfileAvatarForm } from "./profile-avatar-form";
import type { ProfileFormProps, ProfileFormResponse } from "./types";

export function ProfileForm({
  initialName,
  email,
}: ProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  async function saveProfile(nextName: string) {
    try {
      const res = await authFetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = (await res.json()) as ProfileFormResponse;

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to update account",
        );
      }

      const savedName = data.user?.name ?? nextName.trim();
      setName(savedName);
      setSavedName(savedName);
      dispatchProfileNameChanged(savedName);
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Failed to update account");
    }
  }

  async function onProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      await saveProfile(name);
      setProfileStatus("Saved");
    } catch (error) {
      setProfileStatus(
        error instanceof Error ? error.message : "Failed to update account",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      <form
        onSubmit={onProfileSubmit}
        className="space-y-6 rounded-b-lg rounded-t-3xl bg-white p-6"
      >
        <div className="flex items-center gap-4">
          <ProfileAvatarForm name={name} colorSeed={email} />
          <div>
            <p className="text-sm font-medium text-neutral-900">
              Profile picture
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Choose a picture to show across your account.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountEmail">Realmroot email</Label>
          <Input
            id="accountEmail"
            value={email}
            type="email"
            readOnly
            aria-readonly="true"
            className="bg-neutral-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={savingProfile || name.trim() === savedName}
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </Button>
          {profileStatus && (
            <p className="text-sm text-neutral-500">{profileStatus}</p>
          )}
        </div>
      </form>

      <p className="p-6 text-sm text-neutral-500">Sign-in, password recovery, and two-factor authentication are managed in Realmroot.</p>
    </>
  );
}
