import { createBrowserRouter, Navigate } from "react-router";
import { Welcome } from "./screens/Welcome";
import { SignUp } from "./screens/SignUp";
import { SignUpDetails } from "./screens/SignUpDetails";
import { LogIn } from "./screens/LogIn";
import { ProfileSetup1 } from "./screens/ProfileSetup1";
import { ProfileSetup2 } from "./screens/ProfileSetup2";
import { MainShell } from "./screens/MainShell";
import { Feed } from "./screens/Feed";
import { Discover } from "./screens/Discover";
import { TripDetail } from "./screens/TripDetail";
import { MyTrips } from "./screens/MyTrips";
import { SavedRedirect } from "./screens/SavedRedirect";
import { Profile } from "./screens/Profile";
import { Friends } from "./screens/Friends";
import { Explore } from "./screens/Explore";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Welcome,
  },
  {
    path: "/signup",
    Component: SignUp,
  },
  {
    path: "/signup/details",
    Component: SignUpDetails,
  },
  {
    path: "/login",
    Component: LogIn,
  },
  {
    path: "/setup/profile",
    Component: ProfileSetup1,
  },
  {
    path: "/setup/activities",
    Component: ProfileSetup2,
  },
  {
    path: "/app",
    Component: MainShell,
    children: [
      { index: true, Component: Feed },
      { path: "explore", Component: Explore },
      { path: "discover", Component: Discover },
      { path: "mytrips", Component: MyTrips },
      { path: "saved", Component: SavedRedirect },
      { path: "profile", Component: Profile },
      { path: "friends", Component: Friends },
      { path: "trip/:id", Component: TripDetail },
    ],
  },
]);