package com.sonyir.remote

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.hardware.ConsumerIrManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

class MainActivity : Activity() {

    // ---- Code sets to try. Sony audio gear uses device 0x10 with these commands. ----
    private data class Profile(val name: String, val bits: Int, val address: Int)

    private val profiles = listOf(
        Profile("Sony Audio 15-bit (speakers/soundbars)", 15, 0x10),
        Profile("Sony Audio 12-bit (hi-fi/receivers)", 12, 0x10),
        Profile("Sony Audio 20-bit", 20, 0x10)
    )

    /** Commands shared by Sony audio devices. Buttons not listed here start unassigned. */
    private val coreCommands = mapOf(
        "power" to 0x15,
        "vol_up" to 0x12,
        "vol_down" to 0x13,
        "mute" to 0x14
    )

    private data class Key(val id: String, val label: String)

    private val allKeys = listOf(
        Key("power", "Power"), Key("vol_up", "Vol +"), Key("vol_down", "Vol −"),
        Key("mute", "Mute"), Key("input", "Input"), Key("play", "Play / Pause"),
        Key("prev", "Prev"), Key("next", "Next"), Key("bass_up", "Bass +"),
        Key("bass_down", "Bass −"), Key("sound", "Sound mode"), Key("bt", "Bluetooth")
    )

    private var ir: ConsumerIrManager? = null
    private lateinit var prefs: SharedPreferences
    private val sender = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var status: TextView
    private lateinit var profileBtn: Button
    private lateinit var finderPanel: LinearLayout

    // Code Finder state
    private var finderBits = 15
    private var finderCommand = 0
    private lateinit var finderAddr: EditText
    private lateinit var finderExt: EditText
    private lateinit var finderCmdView: TextView
    private lateinit var finderBitsBtn: Button

    private val bg = Color.parseColor("#121216")
    private val keyColor = Color.parseColor("#2A2A33")
    private val accent = Color.parseColor("#5C6BC0")
    private val red = Color.parseColor("#E53935")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("remote", Context.MODE_PRIVATE)
        ir = getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
        window.statusBarColor = bg
        window.navigationBarColor = bg
        setContentView(buildUi())
        updateStatus()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        sender.shutdown()
    }

    // ---------------------------------------------------------------- IR sending

    private val profile: Profile
        get() = profiles[prefs.getInt("profile", 0).coerceIn(0, profiles.size - 1)]

    private fun codeFor(keyId: String): IrCode? {
        IrCode.parse(prefs.getString("code_$keyId", null))?.let { return it }
        val cmd = coreCommands[keyId] ?: return null
        val p = profile
        return IrCode(p.bits, p.address, cmd)
    }

    private fun hasIr(): Boolean = ir?.hasIrEmitter() == true

    private fun send(code: IrCode) {
        val mgr = ir
        if (mgr == null || !mgr.hasIrEmitter()) {
            toast("This phone's IR blaster isn't available")
            return
        }
        val pattern = Sirc.pattern(code)
        sender.execute {
            try {
                mgr.transmit(Sirc.CARRIER_HZ, pattern)
            } catch (e: Exception) {
                handler.post { toast("IR error: ${e.message}") }
            }
        }
    }

    private fun press(keyId: String, v: View) {
        v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        val code = codeFor(keyId)
        if (code == null) {
            toast("Not set yet. Long-press to enter a code, or find it with Code Finder.")
            return
        }
        send(code)
        status.text = "Sent ${labelOf(keyId)} · ${code.describe()}"
    }

    private fun labelOf(id: String) = allKeys.firstOrNull { it.id == id }?.label ?: id

    // ---------------------------------------------------------------- UI

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun bgDrawable(color: Int, radius: Int): RippleDrawable {
        val shape = GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
        }
        return RippleDrawable(ColorStateList.valueOf(0x40FFFFFF), shape, null)
    }

    private fun styledButton(text: String, color: Int = keyColor, size: Float = 17f, radius: Int = 18): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            textSize = size
            setTextColor(Color.WHITE)
            background = bgDrawable(color, radius)
            stateListAnimator = null
        }

    private fun row(vararg views: View, height: Int = 64): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            for (v in views) {
                addView(v, LinearLayout.LayoutParams(0, dp(height), 1f).apply {
                    setMargins(dp(6), dp(6), dp(6), dp(6))
                })
            }
        }

    /** A remote button: tap sends, long-press edits its code. */
    private fun keyButton(keyId: String, label: String = labelOf(keyId), color: Int = keyColor): Button =
        styledButton(label, color).apply {
            setOnClickListener { press(keyId, it) }
            setOnLongClickListener { editCode(keyId); true }
        }

    /** Volume buttons repeat while held. */
    @SuppressLint("ClickableViewAccessibility")
    private fun repeatButton(keyId: String, label: String): Button {
        val b = styledButton(label, keyColor, 22f)
        val repeater = object : Runnable {
            override fun run() {
                press(keyId, b)
                handler.postDelayed(this, 180)
            }
        }
        b.setOnTouchListener { v, ev ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN -> {
                    v.isPressed = true
                    press(keyId, v)
                    handler.postDelayed(repeater, 450)
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    v.isPressed = false
                    handler.removeCallbacks(repeater)
                }
            }
            true
        }
        return b
    }

    private fun label(text: String, size: Float, color: Int = Color.WHITE, bold: Boolean = false) =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(28), dp(14), dp(28))
            setBackgroundColor(bg)
        }

        root.addView(label("SA-D40 M2", 26f, bold = true))
        root.addView(label("Sony speaker IR remote", 14f, Color.parseColor("#9FA8DA")))

        status = label("", 13f, Color.parseColor("#B0B0B8"))
        root.addView(status)

        // Power
        val power = keyButton("power", "⏻  Power", red)
        root.addView(row(power, height = 72))

        // Code set selector
        profileBtn = styledButton("", Color.parseColor("#1E1E26"), 14f).apply {
            setOnClickListener {
                val next = (prefs.getInt("profile", 0) + 1) % profiles.size
                prefs.edit().putInt("profile", next).apply()
                updateStatus()
                toast("Code set: ${profiles[next].name}")
            }
        }
        root.addView(row(profileBtn, height = 52))

        // Volume
        root.addView(row(repeatButton("vol_down", "−"), keyButton("mute", "Mute"), repeatButton("vol_up", "+"), height = 84))

        root.addView(label("More buttons (long-press any button to set its code)", 12f, Color.parseColor("#80808A")))
        root.addView(row(keyButton("input"), keyButton("bt")))
        root.addView(row(keyButton("prev", "⏮"), keyButton("play", "⏯"), keyButton("next", "⏭")))
        root.addView(row(keyButton("bass_down"), keyButton("sound"), keyButton("bass_up")))

        // Code finder
        val finderToggle = styledButton("🔍  Code Finder", accent, 15f).apply {
            setOnClickListener {
                finderPanel.visibility = if (finderPanel.visibility == View.VISIBLE) View.GONE else View.VISIBLE
            }
        }
        root.addView(row(finderToggle, height = 54))
        finderPanel = buildFinder().apply { visibility = View.GONE }
        root.addView(finderPanel)

        return ScrollView(this).apply {
            setBackgroundColor(bg)
            isFillViewport = true
            addView(root)
        }
    }

    private fun hexField(initial: String): EditText = EditText(this).apply {
        setText(initial)
        setTextColor(Color.WHITE)
        setHintTextColor(Color.GRAY)
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        gravity = Gravity.CENTER
        background = bgDrawable(Color.parseColor("#1E1E26"), 12)
    }

    private fun parseHex(s: String): Int? =
        s.trim().removePrefix("0x").removePrefix("0X").takeIf { it.isNotEmpty() }?.toIntOrNull(16)

    private fun buildFinder(): LinearLayout {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(4), dp(8), dp(4), dp(8))
        }
        panel.addView(label(
            "Point the phone at the speaker. Step through commands and watch for a reaction. " +
                "When something works, save it to a button.", 13f, Color.parseColor("#B0B0B8")))

        finderBitsBtn = styledButton("SIRC-$finderBits", keyColor, 15f).apply {
            setOnClickListener {
                finderBits = when (finderBits) { 15 -> 12; 12 -> 20; else -> 15 }
                text = "SIRC-$finderBits"
                finderExt.visibility = if (finderBits == 20) View.VISIBLE else View.INVISIBLE
            }
        }
        finderAddr = hexField("10").apply { hint = "addr hex" }
        finderExt = hexField("00").apply { hint = "ext hex"; visibility = View.INVISIBLE }
        panel.addView(row(finderBitsBtn, finderAddr, finderExt, height = 54))

        finderCmdView = label("", 20f, bold = true).apply { gravity = Gravity.CENTER }
        val minus = styledButton("◀", keyColor, 20f).apply { setOnClickListener { stepFinder(-1) } }
        val plus = styledButton("▶", keyColor, 20f).apply { setOnClickListener { stepFinder(1) } }
        panel.addView(row(minus, finderCmdView, plus))
        updateFinderLabel()

        val sendBtn = styledButton("Send", accent).apply {
            setOnClickListener { v ->
                v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                finderCode()?.let { send(it); status.text = "Sent ${it.describe()}" }
            }
        }
        val nextSend = styledButton("Next + Send", accent).apply {
            setOnClickListener { v ->
                stepFinder(1)
                v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                finderCode()?.let { send(it); status.text = "Sent ${it.describe()}" }
            }
        }
        panel.addView(row(sendBtn, nextSend))

        val save = styledButton("Save to button…", keyColor, 15f).apply {
            setOnClickListener { saveFinderToButton() }
        }
        val reset = styledButton("Reset all buttons", keyColor, 15f).apply {
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage("Clear every code you saved and go back to the default code set?")
                    .setPositiveButton("Reset") { _, _ ->
                        val e = prefs.edit()
                        allKeys.forEach { e.remove("code_${it.id}") }
                        e.apply()
                        toast("Buttons reset")
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            }
        }
        panel.addView(row(save, reset, height = 54))
        return panel
    }

    private fun stepFinder(d: Int) {
        finderCommand = (finderCommand + d + 128) % 128
        updateFinderLabel()
    }

    private fun updateFinderLabel() {
        finderCmdView.text = "cmd 0x%02X (%d)".format(finderCommand, finderCommand)
    }

    private fun finderCode(): IrCode? {
        val addr = parseHex(finderAddr.text.toString())
        val ext = parseHex(finderExt.text.toString()) ?: 0
        if (addr == null) { toast("Enter the address in hex, e.g. 10"); return null }
        return IrCode(finderBits, addr, finderCommand, ext)
    }

    private fun saveFinderToButton() {
        val code = finderCode() ?: return
        val names = allKeys.map { it.label }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Save ${code.describe()} to…")
            .setItems(names) { _, which ->
                val k = allKeys[which]
                prefs.edit().putString("code_${k.id}", code.serialize()).apply()
                toast("Saved to ${k.label}")
            }
            .show()
    }

    /** Long-press dialog for setting one button's code by hand. */
    private fun editCode(keyId: String) {
        val current = codeFor(keyId) ?: IrCode(profile.bits, profile.address, 0)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(0))
        }
        fun field(hint: String, value: String) = EditText(this).apply {
            this.hint = hint
            setText(value)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        val bitsF = field("Bits: 12, 15 or 20", current.bits.toString()).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
        }
        val addrF = field("Address (hex)", "%02X".format(current.address))
        val cmdF = field("Command (hex)", "%02X".format(current.command))
        val extF = field("Extended (hex, 20-bit only)", "%02X".format(current.extended))
        listOf(bitsF, addrF, cmdF, extF).forEach { box.addView(it) }

        AlertDialog.Builder(this)
            .setTitle("Code for ${labelOf(keyId)}")
            .setView(box)
            .setPositiveButton("Save") { _, _ ->
                val bits = bitsF.text.toString().toIntOrNull()
                val addr = parseHex(addrF.text.toString())
                val cmd = parseHex(cmdF.text.toString())
                val ext = parseHex(extF.text.toString()) ?: 0
                if (bits !in listOf(12, 15, 20) || addr == null || cmd == null || cmd > 127) {
                    toast("Invalid code, nothing saved")
                } else {
                    val code = IrCode(bits!!, addr, cmd, ext)
                    prefs.edit().putString("code_$keyId", code.serialize()).apply()
                    toast("Saved: ${code.describe()}")
                }
            }
            .setNeutralButton("Use default") { _, _ ->
                prefs.edit().remove("code_$keyId").apply()
                toast("${labelOf(keyId)} uses the default code set")
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateStatus() {
        profileBtn.text = "Code set: ${profile.name}  ·  tap to switch"
        status.text = when {
            ir == null -> "⚠ No IR service found on this phone"
            !hasIr() -> "⚠ IR blaster not detected"
            else -> "IR blaster ready. Point the top of the phone at the speaker."
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
