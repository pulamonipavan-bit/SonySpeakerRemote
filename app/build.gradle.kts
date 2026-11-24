plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sonyir.remote"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sonyir.remote"
        minSdk = 23
        targetSdk = 36
        versionCode = 3
        versionName = "1.2"
    }

    // Fixed key so every GitHub build can install over the previous one.
    signingConfigs {
        create("fixed") {
            storeFile = file("remote.keystore")
            storePassword = "remote123"
            keyAlias = "remote"
            keyPassword = "remote123"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("fixed")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("fixed")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// No external libraries needed: the app uses only the Android framework.
