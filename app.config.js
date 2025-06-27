// app.config.js
import 'dotenv/config';

export default {
  expo: {
    name: "Cloudrain",
    slug: "novel-author-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo/icon.png",
    // userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/logo/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: { supportsTablet: true },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo/foreground.png",
        backgroundImage: "./assets/logo/background.png"
      },
      edgeToEdgeEnabled: true,
      package: "com.wz1242.novelauthorapp"
    },
    web: { favicon: "./assets/logo/favicon.png" },
    extra: {
      eas: { projectId: "048ace5b-0b81-4661-9d1f-7fbf8ab55464" }
    },
    owner: "wz1242",
    plugins: [
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
            buildToolsVersion: "35.0.0"
          }
        }
      ]
    ]
  }
};
