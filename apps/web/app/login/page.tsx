import Link from "next/link";
import { Logo } from "../../components/Logo";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { login } from "../auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <Logo variant="full" size="md" />
      </div>

      <div className="flex-1 px-8 py-8">
        <h1 className="text-2xl font-bold mb-8">Welcome Back</h1>

        {error && (
          <p className="bg-red-50 text-red-700 px-4 py-3 text-sm mb-6">
            {decodeURIComponent(error)}
          </p>
        )}

        <form action={login} className="flex flex-col gap-6">
          <Input label="Email" name="email" type="email" placeholder="Enter your email" required autoComplete="email" />
          <Input label="Password" name="password" type="password" placeholder="Enter your password" required autoComplete="current-password" />

          <Button type="submit" fullWidth className="mt-4">
            Log In
          </Button>

          <p className="text-center text-sm text-[#212121]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline font-semibold text-black">
              Sign Up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
