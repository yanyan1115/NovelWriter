import 'dotenv/config';

export default {
  expo: {
    name: "Cloudrain",
    slug: "novel-author-app",
    version: "1.3.2",
    orientation: "portrait",
    icon: "./assets/icon.png",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    // 添加 assetBundlePatterns 确保字体文件被正确打包
    assetBundlePatterns: [
      "**/*"
    ],
    ios: { 
      supportsTablet: true,
      // iOS 字体配置
      infoPlist: {
        UIAppFonts: [
          "Kai.ttf",
          "ShouZha.ttf", 
          "ShouJin.ttf",
          "Song.ttf"
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/foreground.png",
        backgroundImage: "./assets/background.png"
      },
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: "resize",
      package: "com.wz1242.novelauthorapp",
      permissions: [
        "READ_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES"
      ]
    },
    extra: {
      eas: { projectId: "048ace5b-0b81-4661-9d1f-7fbf8ab55464" }
    },
    owner: "wz1242",
    plugins: [
      [
        "expo-font",
        {
          // 配置字体文件，确保构建时正确处理
          fonts: [
            "./assets/fonts/Kai.ttf",
            "./assets/fonts/ShouZha.ttf",
            "./assets/fonts/ShouJin.ttf", 
            "./assets/fonts/Song.ttf"
          ]
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 34, // 保持 34，只更新 compileSdk
            minSdkVersion: 24,
            // 解决 JVM 版本问题的关键配置
            javaVersion: "17",
            kotlinVersion: "1.9.10",
            // Gradle 属性配置
            proguardMinifyEnabled: false,
            enableShrinkResourcesInReleaseBuilds: false,
            // 确保 JVM 参数一致
            gradleProperties: {
              "org.gradle.jvmargs": "-Xmx2048m -XX:MaxMetaspaceSize=512m",
              "android.useAndroidX": "true",
              "android.enableJetifier": "true",
              // 强制统一 JVM 目标版本
              "kotlin.jvm.target.validation.mode": "WARNING"
            }
          }
        }
      ]
    ]
  }
};