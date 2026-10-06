import type { ExpoConfig } from "expo/config";

/**
 * Configuration Expo pilotée par l'environnement (§52, §56) : identifiants, domaine des
 * Universal/App Links et nom de l'app sont des variables — rien n'est figé pour un compte store.
 * Voir SETUP_REQUIRED.md pour la liste complète.
 */
const env = (k: string, d: string) => process.env[k] ?? d;

const APP_NAME = env("APP_NAME", "Montage");
const SCHEME = env("APP_SCHEME", "montage");
const BUNDLE_ID = env("APP_BUNDLE_ID", "com.example.montage");
const ANDROID_PACKAGE = env("APP_ANDROID_PACKAGE", BUNDLE_ID);
const LINK_DOMAIN = env("APP_LINK_DOMAIN", "app.example.com"); // Universal Links / App Links
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: APP_NAME,
  slug: env("APP_SLUG", "montage"),
  version: env("APP_VERSION", "1.0.0"),
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: SCHEME,
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: env("APP_BUILD_NUMBER", "1"),
    supportsTablet: false,   // V1 iPhone uniquement : pas de captures ni de tests iPad à fournir à App Review
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${LINK_DOMAIN}`],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      // Demandées uniquement au moment où l'utilisateur choisit une vidéo / enregistre un message vocal.
      NSPhotoLibraryUsageDescription: "Choisissez les vidéos que vous voulez faire monter.",
      NSPhotoLibraryAddUsageDescription: "Enregistrez votre vidéo terminée dans votre galerie.",
      NSCameraUsageDescription: "Filmez une vidéo directement depuis l'application.",
      NSMicrophoneUsageDescription: "Dictez vos instructions de montage à voix haute.",
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
      ],
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: Number(env("APP_BUILD_NUMBER", "1")),
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    // Permissions minimales : la galerie et le micro sont demandés à l'usage ; aucune au démarrage.
    permissions: ["android.permission.RECORD_AUDIO", "android.permission.POST_NOTIFICATIONS"],
    blockedPermissions: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.SYSTEM_ALERT_WINDOW"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: LINK_DOMAIN, pathPrefix: "/invite" }, { scheme: "https", host: LINK_DOMAIN, pathPrefix: "/project" },
               { scheme: "https", host: LINK_DOMAIN, pathPrefix: "/video" }, { scheme: "https", host: LINK_DOMAIN, pathPrefix: "/payment" },
               { scheme: "https", host: LINK_DOMAIN, pathPrefix: "/auth/callback" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: { output: "single", favicon: "./assets/images/favicon.png", bundler: "metro" },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#FFFFFF", image: "./assets/images/splash-icon.png", imageWidth: 96 }],
    "expo-secure-store",
    "expo-apple-authentication",
    "expo-web-browser",
    ["expo-image-picker", {
      photosPermission: "Choisissez les vidéos que vous voulez faire monter.",
      cameraPermission: "Filmez une vidéo directement depuis l'application.",
      microphonePermission: false,
    }],
    ["expo-media-library", { savePhotosPermission: "Enregistrez votre vidéo terminée dans votre galerie.", photosPermission: false, isAccessMediaLocationEnabled: false, granularPermissions: ["video"] }],
    ["expo-audio", { microphonePermission: "Dictez vos instructions de montage à voix haute." }],
    ["expo-notifications", { color: "#FF3B30" }],
    "expo-iap",
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined, linkDomain: LINK_DOMAIN },
};

export default config;
