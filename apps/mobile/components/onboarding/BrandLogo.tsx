import { View, ViewStyle } from "react-native";

interface BrandLogoProps {
  size?: number;
  style?: ViewStyle;
}

export function BrandLogo({ size = 72, style }: BrandLogoProps) {
  const width = Math.round(size * (56 / 72));
  const crossbarTop = Math.round(size * 0.25);
  const crossbarHeight = Math.round(size * 0.19);
  const stemWidth = Math.round(width * 0.29);
  const stemLeft = Math.round(width * 0.36);

  return (
    <View style={[{ width, height: size }, style]}>
      <View style={{
        position: "absolute", top: crossbarTop,
        left: 0, right: 0, height: crossbarHeight,
        backgroundColor: "#2ECDA7", borderRadius: crossbarHeight / 2,
      }} />
      <View style={{
        position: "absolute", top: 0, bottom: 0,
        left: stemLeft, width: stemWidth,
        backgroundColor: "#0A7AFF", borderRadius: stemWidth / 2,
      }} />
      <View style={{
        position: "absolute", top: crossbarTop,
        left: stemLeft, width: stemWidth, height: crossbarHeight,
        backgroundColor: "#5BC8D6", opacity: 0.65,
      }} />
    </View>
  );
}
