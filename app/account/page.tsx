import type { Metadata } from "next";
import { isFreeSignupOwner } from "@/lib/free-owner";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in with Google and edit your Territory Game profile.",
};

export default async function AccountPage() {
  return (
    <>
      {(await isFreeSignupOwner()) && (
        <nav aria-label="Owner tools" className="mx-auto max-w-4xl p-4">
          <a href="/free/activity">View PixaShop signup activity →</a>
        </nav>
      )}
      <AccountClient />
    </>
  );
}
