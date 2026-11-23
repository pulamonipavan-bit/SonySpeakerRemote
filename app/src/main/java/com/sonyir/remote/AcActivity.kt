package com.sonyir.remote

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.hardware.ConsumerIrManager
import android.os.Bundle
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

/** Remote for LG Dual Inverter air conditioners. */
class AcActivity : Activity() {

    private var ir: ConsumerIrManager? = null
    private lateinit var prefs: SharedPreferences
    private val sender = Executors.newSingleThreadExecutor()

    private var temp = 24
    private var mode = LgAc.MODE_COOL
    private var fan = LgAc.FAN_AUTO
    private var lg2 = true

    private lateinit var tempView: TextView
    private lateinit var infoView: TextView
    private lateinit var status: TextView
    private lateinit var modeBtn: Button
    private lateinit var fanBtn: Button
    private lateinit var signalBtn: Button

    private val bg = Color.parseColor("#0E1A24")
    private val keyColor = Color.parseColor("#1F3142")
    private val blue = Color.parseColor("#29B6F6")
    private val green = Color.parseColor("#2E7D32")
    private val red = Color.parseColor("#C62828")

    private val modes = listOf(LgAc.MODE_COOL to "❄ Cool", LgAc.MODE_DRY to "💧 Dry",
        LgAc.MODE_FAN to "🌀 Fan", LgAc.MODE_AUTO to "Ⓐ Auto")
    private val fans = listOf(LgAc.FAN_AUTO to "Auto", LgAc.FAN_LOW to "Low",
        LgAc.FAN_MED to "Medium", LgAc.FAN_HIGH to "High")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("lg_ac", Context.MODE_PRIVATE)
        temp = prefs.getInt("temp", 24)
        mode = prefs.getInt("mode", LgAc.MODE_COOL)
        fan = prefs.getInt("fan", LgAc.FAN_AUTO)
        lg2 = prefs.getBoolean("lg2", true)
        ir = getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
        window.statusBarColor = bg
        window.navigationBarColor = bg
        setContentView(buildUi())
        refresh()
        status.text = if (ir?.hasIrEmitter() == true) "IR blaster ready. Point the phone at the AC."
        else "⚠ IR blaster not detected"
    }

    override fun onDestroy() {
        super.onDestroy()
        sender.shutdown()
    }

    // ------------------------------------------------------------ sending

    private fun save() {
        prefs.edit().putInt("temp", temp).putInt("mode", mode).putInt("fan", fan)
            .putBoolean("lg2", lg2).apply()
    }

    private fun send(code: Int, what: String, v: View) {
        v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        val mgr = ir
        if (mgr == null || !mgr.hasIrEmitter()) { toast("IR blaster not available"); return }
        val pattern = LgAc.pattern(code, lg2)
        sender.execute {
            try { mgr.transmit(LgAc.CARRIER_HZ, pattern) }
            catch (e: Exception) { runOnUiThread { toast("IR error: ${e.message}") } }
        }
        status.text = "Sent $what  (${LgAc.hex(code)}, ${if (lg2) "LG2" else "LG"})"
    }

    /** Sends the full current setting; this also switches the AC on. */
    private fun sendState(what: String, v: View) {
        save()
        refresh()
        send(LgAc.stateCode(mode, temp, fan), what, v)
    }

    // ------------------------------------------------------------ UI

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun btn(text: String, color: Int = keyColor, size: Float = 17f): Button = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = size
        setTextColor(Color.WHITE)
        stateListAnimator = null
        val shape = GradientDrawable().apply { setColor(color); cornerRadius = dp(18).toFloat() }
        background = RippleDrawable(ColorStateList.valueOf(0x40FFFFFF), shape, null)
    }

    private fun row(vararg views: View, height: Int = 64) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        for (v in views) addView(v, LinearLayout.LayoutParams(0, dp(height), 1f).apply {
            setMargins(dp(6), dp(6), dp(6), dp(6))
        })
    }

    private fun text(s: String, size: Float, color: Int = Color.WHITE, bold: Boolean = false) =
        TextView(this).apply {
            text = s; textSize = size; setTextColor(color)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(28), dp(14), dp(28))
            setBackgroundColor(bg)
        }
        root.addView(text("LG Dual Inverter AC", 24f, bold = true))
        status = text("", 13f, Color.parseColor("#90A4AE"))
        root.addView(status)

        val on = btn("⏻  ON", green, 19f).apply { setOnClickListener { sendState("ON", it) } }
        val off = btn("⏻  OFF", red, 19f).apply { setOnClickListener { send(LgAc.OFF, "OFF", it) } }
        root.addView(row(on, off, height = 70))

        // Temperature display
        val display = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val shape = GradientDrawable().apply {
                setColor(Color.parseColor("#132634")); cornerRadius = dp(24).toFloat()
            }
            background = shape
            setPadding(dp(8), dp(18), dp(8), dp(18))
        }
        tempView = text("", 64f, blue, bold = true).apply { gravity = Gravity.CENTER }
        infoView = text("", 16f, Color.parseColor("#B0BEC5")).apply { gravity = Gravity.CENTER }
        display.addView(tempView)
        display.addView(infoView)
        root.addView(display, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(dp(6), dp(10), dp(6), dp(6)) })

        val minus = btn("−", keyColor, 30f).apply {
            setOnClickListener { if (temp > 18) temp--; sendState("$temp°C", it) }
        }
        val plus = btn("+", keyColor, 30f).apply {
            setOnClickListener { if (temp < 30) temp++; sendState("$temp°C", it) }
        }
        root.addView(row(minus, plus, height = 84))

        modeBtn = btn("").apply {
            setOnClickListener {
                val i = modes.indexOfFirst { it.first == mode }
                mode = modes[(i + 1) % modes.size].first
                sendState("mode", it)
            }
        }
        fanBtn = btn("").apply {
            setOnClickListener {
                val i = fans.indexOfFirst { it.first == fan }
                fan = fans[(i + 1) % fans.size].first
                sendState("fan", it)
            }
        }
        root.addView(row(modeBtn, fanBtn))

        val swing = btn("↕ Swing").apply { setOnClickListener { send(LgAc.SWING_TOGGLE, "Swing", it) } }
        val light = btn("💡 Display light").apply { setOnClickListener { send(LgAc.LIGHT_TOGGLE, "Light", it) } }
        root.addView(row(swing, light))

        root.addView(text("If the AC doesn't respond, switch the signal type and press ON again.",
            12f, Color.parseColor("#78909C")))
        signalBtn = btn("", Color.parseColor("#16222C"), 14f).apply {
            setOnClickListener {
                lg2 = !lg2
                save(); refresh()
                toast("Signal: ${if (lg2) "LG2 (newer remotes)" else "LG (older remotes)"}")
            }
        }
        root.addView(row(signalBtn, height = 52))

        return ScrollView(this).apply {
            setBackgroundColor(bg)
            isFillViewport = true
            addView(root)
        }
    }

    private fun refresh() {
        val modeName = modes.firstOrNull { it.first == mode }?.second ?: "?"
        val fanName = fans.firstOrNull { it.first == fan }?.second ?: "?"
        tempView.text = if (mode == LgAc.MODE_FAN) "—" else "$temp°C"
        infoView.text = "$modeName   ·   Fan $fanName"
        modeBtn.text = "Mode: $modeName"
        fanBtn.text = "Fan: $fanName"
        signalBtn.text = "Signal type: ${if (lg2) "LG2 (newer)" else "LG (older)"}  ·  tap to switch"
    }

    private fun toast(m: String) = Toast.makeText(this, m, Toast.LENGTH_SHORT).show()
}
