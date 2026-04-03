import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

// ─── Image picker ─────────────────────────────────────────────────────────────

export async function pickImage(aspect: [number, number] = [1, 1]): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadToStorage(
  bucket: string,
  path: string,
  localUri: string,
): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.error(`Storage upload error [${bucket}/${path}]:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Upload failed:", err);
    return null;
  }
}

// ─── Public upload functions ──────────────────────────────────────────────────

export async function uploadAvatar(userId: string, localUri: string): Promise<string | null> {
  return uploadToStorage("avatars", `${userId}.jpg`, localUri);
}

export async function uploadTripCover(tripId: string, localUri: string): Promise<string | null> {
  return uploadToStorage("trip-covers", `${tripId}.jpg`, localUri);
}

export async function uploadReviewPhoto(reviewKey: string, localUri: string): Promise<string | null> {
  return uploadToStorage("review-photos", `${reviewKey}.jpg`, localUri);
}

export async function uploadPostPhoto(userId: string, adventureId: string, key: string, localUri: string): Promise<string | null> {
  return uploadToStorage("posts", `${userId}/${adventureId}/${key}.jpg`, localUri);
}
