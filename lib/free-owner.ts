import { auth } from "@/auth";
export async function isFreeSignupOwner() {
  const user = (await auth())?.user;
  return Boolean(
    process.env.PIXA_OWNER_USER_ID &&
    user?.id === process.env.PIXA_OWNER_USER_ID &&
    user.email?.toLowerCase() === "luke@webstarts.com",
  );
}
