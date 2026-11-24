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

    private val parrot = Parrot()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.parseColor("#18223A")
        window.navigationBarColor = Color.parseColor("#18223A")

        tts = TextToSpeech(this, this)

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#18223A"))
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
        // Pick the most natural-sounding English voice (or the one the grown-up chose).
        val saved = getSharedPreferences("talk", MODE_PRIVATE).getString("voice", null)
        val list = englishVoices(engine)
        val chosen = list.firstOrNull { it.name == saved } ?: list.firstOrNull()
        if (chosen != null) try { engine.voice = chosen } catch (_: Exception) {}
        engine.setSpeechRate(0.85f)   // natural, warm pace (pauses between sentences do the slowing down)
        engine.setPitch(1.05f)
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

    /** English voices, most natural first: Indian English, high quality, installed. */
    private fun englishVoices(engine: TextToSpeech? = tts): List<android.speech.tts.Voice> {
        val vs = try { engine?.voices?.toList() ?: emptyList() } catch (_: Exception) { emptyList() }
        fun score(v: android.speech.tts.Voice): Int {
            var sc = 0
            if (v.locale.country == "IN") sc += 40 else if (v.locale.country in listOf("GB", "US", "AU")) sc += 20
            sc += v.quality / 25                                   // VERY_HIGH (500) -> +20
            if (v.features?.contains("notInstalled") == true) sc -= 100
            if (v.isNetworkConnectionRequired) sc += 5             // network voices sound most human (falls back offline)
            if (v.name.contains("legacy", true)) sc -= 10
            return sc
        }
        return vs.filter { it.locale.language == "en" && it.features?.contains("notInstalled") != true }.sortedByDescending { score(it) }.take(8)
    }

    // ------------------------------------------------------------ listening

    private fun hasMic() =
        Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    // ------------------------------------------------------------ speech engines
    // Phones differ a lot (Google, on-device, the phone maker's own). We try each one in turn and
    // remember the one that works, instead of giving up after a failure.
    private class Engine(val name: String, val bias: Boolean, val make: () -> SpeechRecognizer)
    private val engines: List<Engine> by lazy { buildEngines() }
    private var engineIdx = 0
    private var engineInUse = -1
    private var vadOnly = false                   // every engine failed: only detect that the child made a sound
    private var lastError = ""
    private var lastWords = ""

    private fun buildEngines(): List<Engine> {
        val list = mutableListOf<Engine>()
        val services = try { packageManager.queryIntentServices(Intent(android.speech.RecognitionService.SERVICE_INTERFACE), 0) } catch (_: Exception) { emptyList() }
        val google = services.firstOrNull { it.serviceInfo.packageName.contains("google", true) }
        // Privacy first: understand speech on the phone itself when possible.
        if (Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(this))
            list += Engine("On-device", true) { SpeechRecognizer.createOnDeviceSpeechRecognizer(this) }
        if (google != null) {
            val cn = android.content.ComponentName(google.serviceInfo.packageName, google.serviceInfo.name)
            list += Engine("Google", true) { SpeechRecognizer.createSpeechRecognizer(this, cn) }
        }
        services.filter { it !== google }.forEach { sv ->
            val cn = android.content.ComponentName(sv.serviceInfo.packageName, sv.serviceInfo.name)
            list += Engine(sv.serviceInfo.packageName.substringAfterLast('.'), false) { SpeechRecognizer.createSpeechRecognizer(this, cn) }
        }
        if (list.isEmpty() && SpeechRecognizer.isRecognitionAvailable(this))
            list += Engine("Default", false) { SpeechRecognizer.createSpeechRecognizer(this) }
        return list
    }

    private fun errName(code: Int) = when (code) {
        1 -> "network timeout"; 2 -> "network"; 3 -> "audio"; 4 -> "server"; 5 -> "client"; 6 -> "no speech"
        7 -> "no match"; 8 -> "busy"; 9 -> "no permission"; 10 -> "too many requests"; 11 -> "server disconnected"
        12 -> "language not supported"; 13 -> "language not downloaded"; else -> "error $code"
    }

    private fun startListening(maxMs: Int, hints: ArrayList<String> = arrayListOf()) {
        stopListening()
        if (!hasMic()) { emit("heard", JSONObject().put("words", JSONArray()).put("error", "nomic")); return }
        val token = ++listenToken
        listenWith(token, maxMs, hints, System.currentTimeMillis(), useBias = true)
    }

    /** Only detect that the child made a sound (last resort). */
    private fun soundOnly(token: Int, ms: Int) {
        parrot.capture(ms.coerceAtLeast(4000), playBack = false) { voiced, _ ->
            if (token == listenToken)
                emit("heard", JSONObject().put("words", JSONArray()).put("sound", voiced).put("error", if (voiced) "" else "silence").put("mode", "sound"))
        }
    }

    private fun listenWith(token: Int, maxMs: Int, hints: ArrayList<String>, turnStart: Long, useBias: Boolean) {
        val remaining = (maxMs - (System.currentTimeMillis() - turnStart)).toInt()
        if (vadOnly || engineIdx >= engines.size) { vadOnly = true; soundOnly(token, remaining); return }
        val eng = engines[engineIdx]
        if (engineInUse != engineIdx) {
            try { recognizer?.destroy() } catch (_: Exception) {}
            recognizer = try { eng.make() } catch (_: Exception) { null }
            engineInUse = engineIdx
        }
        val rec = recognizer ?: run { engineIdx++; listenWith(token, maxMs, hints, turnStart, true); return }
        val started = System.currentTimeMillis()
        rec.setRecognitionListener(object : RecognitionListener {
            private var lastLevel = 0L
            override fun onReadyForSpeech(p: Bundle?) { emit("listening", JSONObject().put("engine", eng.name)) }
            override fun onBeginningOfSpeech() { emit("voice") }
            override fun onRmsChanged(rms: Float) {
                val now = System.currentTimeMillis()
                if (now - lastLevel > 90) { lastLevel = now; emit("level", JSONObject().put("v", rms.toDouble())) }
            }
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(b: Bundle?) {
                if (token != listenToken) return
                val list = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
                if (list.isNotEmpty() && list.any { it.isNotBlank() })
                    emit("partial", JSONObject().put("words", JSONArray(list)))
            }
            override fun onEvent(t: Int, b: Bundle?) {}
            override fun onResults(b: Bundle?) {
                if (token != listenToken) return
                listening = false
                val list = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf()
                lastWords = list.joinToString(" / "); lastError = ""
                emit("heard", JSONObject().put("words", JSONArray(list)).put("sound", list.isNotEmpty()).put("error", "").put("engine", eng.name))
            }
            override fun onError(code: Int) {
                if (token != listenToken) return
                listening = false
                lastError = "${eng.name}: ${errName(code)}"
                val elapsed = System.currentTimeMillis() - started
                val normal = (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) && elapsed > 2500
                if (code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                    emit("heard", JSONObject().put("words", JSONArray()).put("error", "nomic")); return
                }
                if (!normal) {
                    try { rec.cancel() } catch (_: Exception) {}
                    // 1) the word hints may not be supported: retry the same engine without them
                    if (useBias && eng.bias && hints.isNotEmpty() && code in listOf(5, 12, 13, 14)) {
                        main.postDelayed({ if (token == listenToken) listenWith(token, maxMs, hints, turnStart, false) }, 150); return
                    }
                    // 2) try the next speech engine on the phone
                    engineIdx++
                    main.postDelayed({ if (token == listenToken) listenWith(token, maxMs, hints, turnStart, true) }, 150)
                    return
                }
                val err = if (code == SpeechRecognizer.ERROR_NO_MATCH) "nomatch" else "silence"
                emit("heard", JSONObject().put("words", JSONArray()).put("sound", code == SpeechRecognizer.ERROR_NO_MATCH).put("error", err).put("engine", eng.name))
            }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 10)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            if (useBias && eng.bias && Build.VERSION.SDK_INT >= 33 && hints.isNotEmpty())
                putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, hints)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }
        listening = true
        try {
            rec.startListening(intent)
        } catch (e: Exception) {
            listening = false; lastError = "${eng.name}: could not start"
            engineIdx++
            main.postDelayed({ if (token == listenToken) listenWith(token, maxMs, hints, turnStart, true) }, 150)
            return
        }
        main.postDelayed({
            if (token == listenToken && listening) {
                listening = false
                try { rec.cancel() } catch (_: Exception) {}
                emit("heard", JSONObject().put("words", JSONArray()).put("error", "timeout"))
            }
        }, remaining.coerceAtLeast(3000).toLong() + 8000)
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
        fun listen(maxMs: Int) { main.post { tts?.stop(); startListening(maxMs.coerceIn(2000, 12000)) } }

        @JavascriptInterface
        fun listenFor(maxMs: Int, hintsJson: String) {
            val hints = arrayListOf<String>()
            try { val a = JSONArray(hintsJson); for (i in 0 until a.length()) hints.add(a.getString(i)) } catch (_: Exception) {}
            main.post { tts?.stop(); startListening(maxMs.coerceIn(2000, 12000), hints) }
        }

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

        /** Voices the grown-up can choose from. */
        @JavascriptInterface
        fun voices(): String {
            val cur = try { tts?.voice?.name } catch (_: Exception) { null }
            return JSONArray(englishVoices().mapIndexed { i, v ->
                JSONObject().put("name", v.name).put("label", "Voice ${i + 1} (" + v.locale.country.ifEmpty { "EN" } + ")").put("on", v.name == cur)
            }).toString()
        }

        @JavascriptInterface
        fun setVoice(name: String) {
            main.post {
                val v = englishVoices().firstOrNull { it.name == name } ?: return@post
                try { tts?.voice = v } catch (_: Exception) {}
                getSharedPreferences("talk", MODE_PRIVATE).edit().putString("voice", name).apply()
            }
        }

        /** For the grown-up microphone test screen. */
        @JavascriptInterface
        fun diag(): String = JSONObject()
            .put("engines", JSONArray(engines.map { it.name }))
            .put("using", if (vadOnly || engineIdx >= engines.size) "sound only" else engines[engineIdx].name)
            .put("lastError", lastError).put("lastWords", lastWords)
            .put("mic", hasMic()).put("android", Build.VERSION.SDK_INT).toString()

        /** Start again from the first speech engine. */
        @JavascriptInterface
        fun retryEngines() { main.post { vadOnly = false; engineIdx = 0; engineInUse = -1 } }

        @JavascriptInterface
        fun openVoiceSettings() {
            main.post {
                for (action in listOf(android.provider.Settings.ACTION_VOICE_INPUT_SETTINGS, android.provider.Settings.ACTION_SETTINGS)) {
                    try { startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return@post } catch (_: Exception) {}
                }
            }
        }

        /** A short, gentle tap feeling on the phone. */
        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun vibrate(ms: Int) {
            try {
                val v = getSystemService(android.content.Context.VIBRATOR_SERVICE) as? android.os.Vibrator ?: return
                val d = ms.coerceIn(5, 60).toLong()
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(android.os.VibrationEffect.createOneShot(d, 60))
                else v.vibrate(d)
            } catch (_: Exception) {}
        }

        /** New game: give the speech recogniser another chance. */
        @JavascriptInterface
        fun resetListen() { main.post { if (vadOnly) { vadOnly = false; engineIdx = 0; engineInUse = -1 } } }

        /** "speech" = the phone can hear words; "sound" = it can only tell that the child made a sound. */
        @JavascriptInterface
        fun listenMode(): String =
            if (vadOnly || engines.isEmpty()) "sound" else "speech"

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

    /** Back goes to the game's home screen first; only exits from home. */
    private fun handleBack() {
        web.evaluateJavascript("window.goBack ? goBack() : 'exit'") { res ->
            if (res == "\"exit\"") finish()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { handleBack() }   // Android 12 and older


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
