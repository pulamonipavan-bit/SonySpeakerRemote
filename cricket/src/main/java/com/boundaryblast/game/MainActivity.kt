package com.boundaryblast.game

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import java.util.Locale

/** Boundary Blast: hosts the game (assets/index.html) and gives it vibration patterns and a commentary voice. */
class MainActivity : Activity(), TextToSpeech.OnInitListener {

    private lateinit var web: WebView
    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false
    private val main = Handler(Looper.getMainLooper())

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        tts = TextToSpeech(this, this)
        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0B2A21"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = WebViewClient()
            addJavascriptInterface(Bridge(), "Android")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(web)
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) { handleBack() }
        }
        hideSystemBars()
    }

    override fun onInit(status: Int) {
        val engine = tts ?: return
        if (status != TextToSpeech.SUCCESS) return
        for (loc in listOf(Locale("en", "IN"), Locale.UK, Locale.US)) {
            val r = engine.setLanguage(loc)
            if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) break
        }
        try {
            val best = engine.voices?.filter { it.locale.language == "en" && it.features?.contains("notInstalled") != true }
                ?.sortedByDescending { (if (it.locale.country == "IN") 40 else 0) + it.quality / 25 + (if (it.isNetworkConnectionRequired) 5 else 0) }
                ?.firstOrNull()
            if (best != null) engine.voice = best
        } catch (_: Exception) {}
        engine.setSpeechRate(1.08f)    // commentary pace
        engine.setPitch(1.0f)
        ttsReady = true
    }

    inner class Bridge {
        /** Pattern: [off, on, off, on, ...] in ms; amplitudes 1-255 for the "on" parts. */
        @JavascriptInterface
        fun vibrate(patternJson: String, ampJson: String) {
            try {
                val v = getSystemService(VIBRATOR_SERVICE) as? Vibrator ?: return
                val p = JSONArray(patternJson); val a = JSONArray(ampJson)
                val timings = LongArray(p.length()) { p.getLong(it).coerceIn(0, 1500) }
                if (Build.VERSION.SDK_INT >= 26) {
                    val amps = IntArray(timings.size) { i -> if (i % 2 == 0) 0 else a.optInt(i / 2, 255).coerceIn(1, 255) }
                    v.vibrate(VibrationEffect.createWaveform(timings, amps, -1))
                } else {
                    @Suppress("DEPRECATION") v.vibrate(timings, -1)
                }
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun speak(text: String) {
            if (!ttsReady) return
            main.post { tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "c") }
        }

        @JavascriptInterface
        fun stopSpeak() { main.post { tts?.stop() } }
    }

    private fun handleBack() {
        web.evaluateJavascript("window.goBack ? goBack() : 'exit'") { res -> if (res == "\"exit\"") finish() }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { handleBack() }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onPause() {
        super.onPause()
        tts?.stop()
        web.evaluateJavascript("window.onAppPause && onAppPause()", null)
    }

    override fun onDestroy() {
        tts?.shutdown()
        web.destroy()
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= 28) window.attributes.layoutInDisplayCutoutMode =
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
}
