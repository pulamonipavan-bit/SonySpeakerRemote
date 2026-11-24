plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.calmkids.talk"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.calmkids.talk"
        minSdk = 23
        targetSdk = 36
        versionCode = 16
        versionName = "7.0"
    }

    signingConfigs {
        // Play Store upload key: only used when the grown-up has added it as GitHub secrets (never stored in this repo).
        create("upload") {
            val ks = System.getenv("ZIPPY_KEYSTORE_FILE")
            if (ks != null) {
                storeFile = file(ks)
                storePassword = System.getenv("ZIPPY_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ZIPPY_KEY_ALIAS") ?: "zippy-upload"
                keyPassword = System.getenv("ZIPPY_KEYSTORE_PASSWORD")
            }
        }
        create("fixed") {
            storeFile = file("../app/remote.keystore")
            storePassword = "remote123"
            keyAlias = "remote"
            keyPassword = "remote123"
        }
    }

    buildTypes {
        debug { signingConfig = signingConfigs.getByName("fixed") }
        release {
            isMinifyEnabled = false
            signingConfig = if (System.getenv("ZIPPY_KEYSTORE_FILE") != null) signingConfigs.getByName("upload") else null
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
