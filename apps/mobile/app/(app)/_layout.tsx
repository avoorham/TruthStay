import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";
import { Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

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
      color={focused ? "#FFFFFF" : "rgba(255,255,255,0.4)"}
    />
  );
}

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
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
          tabBarIcon: () => (
            <View style={styles.discoverBtn}>
              <Text style={styles.discoverSymbol}>✦</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="trips/index"
        options={{
          title: "Trips",
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
      <Tabs.Screen name="trips/[id]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.feedBg,
    borderTopWidth: 0,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  discoverBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  discoverSymbol: {
    fontSize: 20,
    color: "#FFFFFF",
  },
});
