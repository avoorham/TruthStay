"use client";

import dynamic from "next/dynamic";

export const ExploreMapLoader = dynamic(
  () => import("./ExploreMap").then((m) => m.ExploreMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#ececf0] animate-pulse" />,
  }
);
