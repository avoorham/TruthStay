import Link from "next/link";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div
        className="flex-1 bg-cover bg-center flex items-end justify-center pb-12"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1605271998276-db59cb8455bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080)",
          minHeight: "50vh",
        }}
      >
        <div className="bg-white/30 p-8 mx-6">
          <Logo variant="full" size="lg" />
        </div>
      </div>

      <div className="px-8 py-12 flex flex-col gap-6">
        <p className="text-center text-[#212121]">Share real trips with friends</p>

        <div className="flex flex-col gap-3">
          <Link href="/signup">
            <Button fullWidth>Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" fullWidth>Log In</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
