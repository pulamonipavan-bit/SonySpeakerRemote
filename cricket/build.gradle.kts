plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.boundaryblast.game"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.boundaryblast.game"
        minSdk = 23
        targetSdk = 36
versionCode = 10
        versionName = "7.0.1"
    }

    signingConfigs {
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
            signingConfig = signingConfigs.getByName("fixed")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
