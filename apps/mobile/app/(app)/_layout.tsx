import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabIcon({
  name, focused,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  focused: boolean;
}) {
  return (
    <Feather
      name={name}
      size={24}
      color={focused ? "#FFFFFF" : "rgba(255,255,255,0.55)"}
    />
  );
}

export default function AppLayout() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="feed/index"
        options={{
          title: "Feed",
          tabBarIcon: ({ focused }) => <TabIcon name="align-justify" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore/index"
        options={{
          title: "Explore",
          tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover/index"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => <TabIcon name="zap" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips/index"
        options={{
          title: "My Trips",
          tabBarIcon: ({ focused }) => <TabIcon name="map-pin" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
        }}
      />
      <Tabs.Screen name="trips/[id]"             options={{ href: null }} />
      <Tabs.Screen name="profile/friends"        options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile/notifications"  options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile/language"       options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile/info"           options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}

