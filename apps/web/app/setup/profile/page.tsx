"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
        <p className="text-sm text-[#717182] mt-2">Step 1 of 2</p>
      </div>

      <div className="flex-1 px-8 py-8">
        <form onSubmit={(e) => { e.preventDefault(); router.push("/setup/activities"); }} className="flex flex-col gap-8">
          {/* Business card layout */}
          <div className="bg-[#dadccb] p-4 flex gap-4">
            <div className="w-24 h-24 flex-shrink-0 bg-[#212121] flex items-center justify-center">
              <Camera size={32} className="text-white" />
            </div>
            <div className="flex-1 flex flex-col justify-center gap-2">
              <p className="text-xs text-[#212121]">Upload Photo</p>
              <button type="button" className="text-xs text-left underline font-semibold">
                Choose File
              </button>
            </div>
          </div>

          <Input
            label="Name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block mb-2 text-sm font-medium">Bio (Optional)</label>
            <textarea
              className="w-full px-4 py-3 border border-[#212121] focus:outline-none focus:border-black resize-none"
              rows={4}
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <Button type="submit" fullWidth>Continue</Button>
        </form>
      </div>
    </div>
  );
}
