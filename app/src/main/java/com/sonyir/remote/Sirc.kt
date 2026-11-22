package com.sonyir.remote

/**
 * One infrared code.
 *  bits = 12, 15 or 20  -> Sony SIRC
 *         32            -> NEC (address > 0xFF means extended NEC, 16-bit address)
 *  address  = SIRC device code (5 bits for 12/20-bit, 8 bits for 15-bit) or NEC address
 *  command  = 7-bit SIRC command or 8-bit NEC command
 *  extended = 8-bit extended field (SIRC 20-bit only)
 */
data class IrCode(val bits: Int, val address: Int, val command: Int, val extended: Int = 0) {

    val isNec get() = bits == 32

    fun serialize(): String = "$bits:$address:$command:$extended"

    fun describe(): String = when {
        isNec -> "NEC  addr 0x%02X  cmd 0x%02X".format(address, command)
        bits == 20 -> "SIRC-20  dev 0x%02X  ext 0x%02X  cmd 0x%02X".format(address, extended, command)
        else -> "SIRC-$bits  addr 0x%02X  cmd 0x%02X".format(address, command)
    }

    companion object {
        fun parse(s: String?): IrCode? {
            if (s.isNullOrBlank()) return null
            val p = s.split(":").mapNotNull { it.toIntOrNull() }
            if (p.size < 3) return null
            return IrCode(p[0], p[1], p[2], p.getOrElse(3) { 0 })
        }
    }
}

/** Builds ConsumerIrManager patterns (microseconds, starting with a mark). */
object IrEncoder {

    fun carrier(code: IrCode): Int = if (code.isNec) 38_000 else 40_000

    fun pattern(code: IrCode): IntArray = if (code.isNec) nec(code) else sirc(code)

    // ---------------- Sony SIRC ----------------
    private const val UNIT = 600
    private const val SIRC_PERIOD = 45_000
    private const val SIRC_REPEATS = 3

    private fun sirc(code: IrCode): IntArray {
        val one = sircFrame(code)
        val out = IntArray(one.size * SIRC_REPEATS)
        for (r in 0 until SIRC_REPEATS) System.arraycopy(one, 0, out, r * one.size, one.size)
        return out
    }

    private fun sircFrame(code: IrCode): IntArray {
        val p = ArrayList<Int>(48)
        p.add(4 * UNIT)
        p.add(UNIT)
        fun push(value: Int, count: Int) {
            for (i in 0 until count) {
                p.add(if ((value shr i) and 1 == 1) 2 * UNIT else UNIT)
                p.add(UNIT)
            }
        }
        push(code.command, 7)
        when (code.bits) {
            15 -> push(code.address, 8)
            20 -> { push(code.address, 5); push(code.extended, 8) }
            else -> push(code.address, 5)
        }
        val total = p.sum()
        if (total < SIRC_PERIOD) p[p.size - 1] = p.last() + (SIRC_PERIOD - total)
        return p.toIntArray()
    }

    // ---------------- NEC ----------------
    private fun nec(code: IrCode): IntArray {
        val p = ArrayList<Int>(80)
        p.add(9000); p.add(4500)
        fun byte(b: Int) {
            for (i in 0 until 8) {
                p.add(562)
                p.add(if ((b shr i) and 1 == 1) 1687 else 562)
            }
        }
        if (code.address > 0xFF) {
            byte(code.address and 0xFF); byte((code.address shr 8) and 0xFF)
        } else {
            byte(code.address and 0xFF); byte(code.address.inv() and 0xFF)
        }
        byte(code.command and 0xFF); byte(code.command.inv() and 0xFF)
        p.add(562)
        val total = p.sum()
        p.add(maxOf(108_000 - total, 10_000))
        // NEC repeat code, so devices that need a "held" signal also react
        p.add(9000); p.add(2250); p.add(562); p.add(40_000)
        return p.toIntArray()
    }
}
