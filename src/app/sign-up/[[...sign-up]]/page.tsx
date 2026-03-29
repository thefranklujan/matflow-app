import { redirect } from "next/navigation";

// For now, redirect sign-up to sign-in (dev mode uses hardcoded credentials)
export default function SignUpPage() {
  redirect("/sign-in");
}
