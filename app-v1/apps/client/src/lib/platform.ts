import { Platform } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import type { Platform as AppPlatform } from "@app/config";

export const platform: AppPlatform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
export const appVersion: string = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0";
export const isNative = platform !== "web";
export const linkDomain: string = (Constants.expoConfig?.extra as { linkDomain?: string } | undefined)?.linkDomain ?? "app.example.com";
