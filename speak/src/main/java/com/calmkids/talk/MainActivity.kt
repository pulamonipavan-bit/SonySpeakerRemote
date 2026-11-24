package com.calmkids.talk

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Talk Time: hosts the offline game (assets/index.html) and gives it
 *  - a slow, warm voice (TextToSpeech)
 *  - listening (SpeechRecognizer, falls back to "did the child make a sound?")
 *  - a parrot that repeats the child in a funny voice (Parrot)
 *
 * JavaScript calls Android.* ; results come back through window.native(event, json).
 */
class MainActivity : Activity(), TextToSpeech.OnInitListener {

    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())

    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false

    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var listenToken = 0
    private var recognizerFailures = 0   // after 2 quick failures we switch to simple voice detection

    private val parrot = Parrot()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.parseColor("#F3EEE6")
        window.navigationBarColor = Color.parseColor("#F3EEE6")

        tts = TextToSpeech(this, this)

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F3EEE6"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = WebViewClient()
            addJavascriptInterface(Bridge(), "Android")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(web)
        hideSystemBars()
    }

    // ------------------------------------------------------------ to JavaScript

    private fun emit(event: String, data: JSONObject = JSONObject()) {
        val js = "window.native && window.native(${JSONObject.quote(event)}, ${data})"
        main.post { if (!isFinishing) web.evaluateJavascript(js, null) }
    }

    // ------------------------------------------------------------ voice

    override fun onInit(status: Int) {
        val engine = tts ?: return
        if (status != TextToSpeech.SUCCESS) { emit("ttsFailed"); return }
        for (loc in listOf(Locale("en", "IN"), Locale.UK, Locale.US)) {
            val r = engine.setLanguage(loc)
            if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) break
        }
        engine.setSpeechRate(0.7f)
        engine.setPitch(1.08f)
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { emit("spoken", JSONObject().put("id", id ?: "")) }
            @Deprecated("Deprecated in Java")
            override fun onError(id: String?) { emit("spoken", JSONObject().put("id", id ?: "")) }
            override fun onError(id: String?, errorCode: Int) { emit("spoken", JSONObject().put("id", id ?: "")) }
            override fun onStop(id: String?, interrupted: Boolean) { emit("spoken", JSONObject().put("id", id ?: "")) }
        })
        ttsReady = true
        emit("ready")
    }

    // ------------------------------------------------------------ listening

    private fun hasMic() =
        Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun startListening(maxMs: Int) {
        stopListening()
        if (!hasMic()) { emit("heard", JSONObject().put("words", JSONArray()).put("error", "nomic")); return }
        val token = ++listenToken

        if (!SpeechRecognizer.isRecognitionAvailable(this) || recognizerFailures >= 2) {
            // No recognizer on this phone: just detect whether the child made a sound.
            parrot.capture(maxMs, playBack = false) { voiced, _ ->
                if (token == listenToken)
                    emit("heard", JSONObject().put("words", JSONArray()).put("sound", voiced).put("error", if (voiced) "" else "silence"))
            }
            return
        }

        val started = System.currentTimeMillis()
        val rec = recognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also { recognizer = it }
        rec.setRecognitionListener(object : RecognitionListener {
            private var lastLevel = 0L
            override fun onReadyForSpeech(p: Bundle?) { emit("listening") }
            override fun onBeginningOfSpeech() { emit("voice") }
            override fun onRmsChanged(rms: Float) {
                val now = System.currentTimeMillis()
                if (now - lastLevel > 90) { lastLevel = now; emit("level", JSONObject().put("v", rms.toDouble())) }
            }
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(b: Bundle?) {}
            override fun onEvent(t: Int, b: Bundle?) {}
            override fun onResults(b: Bundle?) {
                if (token != listenToken) return
                listening = false
                recognizerFailures = 0
                val list = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf()
                emit("heard", JSONObject().put("words", JSONArray(list)).put("sound", list.isNotEmpty()).put("error", ""))
            }
            override fun onError(code: Int) {
                if (token != listenToken) return
                listening = false
                val elapsed = System.currentTimeMillis() - started
                val normal = (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) && elapsed > 2500
                if (!normal && code != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                    // The recogniser gave up too early (offline pack missing, busy, network...).
                    // Don't skip the child's turn: keep listening with simple voice detection.
                    recognizerFailures++
                    try { rec.cancel() } catch (_: Exception) {}
                    val remaining = (maxMs - elapsed).toInt().coerceAtLeast(4000)
                    parrot.capture(remaining, playBack = false) { voiced, _ ->
                        if (token == listenToken)
                            emit("heard", JSONObject().put("words", JSONArray()).put("sound", voiced).put("error", if (voiced) "" else "silence"))
                    }
                    return
                }
                val err = when (code) {
                    SpeechRecognizer.ERROR_NO_MATCH -> "nomatch"            // a sound, but not words
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "silence"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "nomic"
                    else -> "error$code"
                }
                emit("heard", JSONObject().put("words", JSONArray()).put("sound", code == SpeechRecognizer.ERROR_NO_MATCH).put("error", err))
            }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 8)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }
        listening = true
        try {
            rec.startListening(intent)
        } catch (e: Exception) {
            listening = false
            emit("heard", JSONObject().put("words", JSONArray()).put("error", "start"))
            return
        }
        // Safety net: never leave the game waiting.
        main.postDelayed({
            if (token == listenToken && listening) {
                listening = false
                try { rec.cancel() } catch (_: Exception) {}
                emit("heard", JSONObject().put("words", JSONArray()).put("error", "timeout"))
            }
        }, maxMs.toLong() + 8000)
    }

    private fun stopListening() {
        listenToken++
        listening = false
        try { recognizer?.cancel() } catch (_: Exception) {}
        parrot.stop()
    }

    // ------------------------------------------------------------ bridge

    inner class Bridge {
        @JavascriptInterface
        fun speak(text: String, id: String) {
            if (!ttsReady) { emit("spoken", JSONObject().put("id", id)); return }
            main.post {
                stopListening()
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            }
        }

        @JavascriptInterface
        fun listen(maxMs: Int) { main.post { tts?.stop(); startListening(maxMs.coerceIn(2000, 10000)) } }

        @JavascriptInterface
        fun parrot(maxMs: Int) {
            main.post {
                tts?.stop()
                stopListening()
                if (!hasMic()) { emit("parrot", JSONObject().put("state", "nomic")); return@post }
                parrot.onPlay = { emit("parrot", JSONObject().put("state", "play")) }
                parrot.capture(maxMs.coerceIn(2000, 10000), playBack = true) { voiced, _ ->
                    emit("parrot", JSONObject().put("state", if (voiced) "done" else "none"))
                }
            }
        }

        @JavascriptInterface
        fun stopAll() { main.post { tts?.stop(); stopListening() } }

        @JavascriptInterface
        fun micState(): String = when {
            hasMic() -> "ok"
            else -> "ask"
        }

        @JavascriptInterface
        fun askMic() {
            main.post {
                if (Build.VERSION.SDK_INT >= 23 && !hasMic())
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 7)
                else emit("mic", JSONObject().put("ok", true))
            }
        }

        @JavascriptInterface
        fun canRecognize(): Boolean = SpeechRecognizer.isRecognitionAvailable(this@MainActivity)
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        emit("mic", JSONObject().put("ok", hasMic()))
    }

    // ------------------------------------------------------------ lifecycle

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.goBack ? goBack() : 'exit'") { res ->
            if (res == "\"exit\"") finish()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onPause() {
        super.onPause()
        tts?.stop()
        stopListening()
        emit("paused")
    }

    override fun onDestroy() {
        stopListening()
        recognizer?.destroy()
        tts?.shutdown()
        parrot.release()
        web.destroy()
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }
}
