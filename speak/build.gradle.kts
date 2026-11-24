plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.calmkids.talk"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.calmkids.talk"
        minSdk = 23
        targetSdk = 34
        versionCode = 6
        versionName = "3.3"
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
