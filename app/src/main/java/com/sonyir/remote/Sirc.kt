package com.sonyir.remote

/**
 * One Sony SIRC infrared code.
 *  bits     = 12, 15 or 20
 *  address  = device code (5 bits for 12/20-bit, 8 bits for 15-bit)
 *  command  = 7-bit command
 *  extended = 8-bit extended field (20-bit codes only)
 */
data class IrCode(val bits: Int, val address: Int, val command: Int, val extended: Int = 0) {

    fun serialize(): String = "$bits:$address:$command:$extended"

    fun describe(): String {
        val base = "SIRC-$bits  addr 0x%02X  cmd 0x%02X".format(address, command)
        return if (bits == 20) "$base  ext 0x%02X".format(extended) else base
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

/** Builds ConsumerIrManager patterns for the Sony SIRC protocol. */
object Sirc {
    const val CARRIER_HZ = 40_000
    private const val UNIT = 600           // microseconds
    private const val FRAME_PERIOD = 45_000 // start-to-start time of each frame
    private const val REPEATS = 3          // Sony devices expect the frame at least 3 times

    fun pattern(code: IrCode): IntArray {
        val one = frame(code)
        val out = IntArray(one.size * REPEATS)
        for (r in 0 until REPEATS) System.arraycopy(one, 0, out, r * one.size, one.size)
        return out
    }

    private fun frame(code: IrCode): IntArray {
        val p = ArrayList<Int>(48)
        p.add(4 * UNIT) // header mark 2.4 ms
        p.add(UNIT)     // space 0.6 ms

        fun push(value: Int, count: Int) {
            for (i in 0 until count) {              // least-significant bit first
                p.add(if ((value shr i) and 1 == 1) 2 * UNIT else UNIT)
                p.add(UNIT)
            }
        }

        push(code.command, 7)
        when (code.bits) {
            12 -> push(code.address, 5)
            15 -> push(code.address, 8)
            20 -> { push(code.address, 5); push(code.extended, 8) }
            else -> push(code.address, 5)
        }

        // Stretch the final space so every frame lasts 45 ms.
        val total = p.sum()
        if (total < FRAME_PERIOD) p[p.size - 1] = p.last() + (FRAME_PERIOD - total)
        return p.toIntArray()
    }
}
