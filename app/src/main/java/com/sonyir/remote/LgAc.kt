package com.sonyir.remote

/**
 * LG air-conditioner IR protocol (28 bits, MSB first, 38 kHz).
 *
 * bits 27-20 signature 0x88
 * bits 19-18 power (0 = on / change, 3 = off)
 * bits 14-12 mode  (0 cool, 1 dry, 2 fan, 3 auto, 4 heat)
 * bits 11-8  temperature - 15
 * bits 7-4   fan   (0 low, 2 medium, 4 high, 5 auto)
 * bits 3-0   checksum = sum of the four nibbles in bits 19-4
 *
 * Two timing variants exist: "LG" (older remotes, 8.5 ms header)
 * and "LG2" (most newer remotes such as Dual Inverter, 3.2 ms header).
 */
object LgAc {
    const val MODE_COOL = 0
    const val MODE_DRY = 1
    const val MODE_FAN = 2
    const val MODE_AUTO = 3

    const val FAN_LOW = 0
    const val FAN_MED = 2
    const val FAN_HIGH = 4
    const val FAN_AUTO = 5

    const val OFF: Int = 0x88C0051
    const val SWING_TOGGLE: Int = 0x8810001
    const val LIGHT_TOGGLE: Int = 0x88C00A6

    fun stateCode(mode: Int, tempC: Int, fan: Int): Int {
        val t = (tempC.coerceIn(16, 30) - 15) and 0xF
        val data = ((mode and 0x7) shl 8) or (t shl 4) or (fan and 0xF) // 16-bit data, power bits = 0
        return withChecksum(0x88 shl 16 or data)
    }

    /** raw24 = signature + 16 data bits; returns the full 28-bit code. */
    private fun withChecksum(raw24: Int): Int {
        val data = raw24 and 0xFFFF
        val s = (((data shr 12) and 0xF) + ((data shr 8) and 0xF) + ((data shr 4) and 0xF) + (data and 0xF)) and 0xF
        return (raw24 shl 4) or s
    }

    fun hex(code: Int) = "0x%07X".format(code)

    fun pattern(code: Int, lg2: Boolean): IntArray {
        val hdrMark = if (lg2) 3200 else 8500
        val hdrSpace = if (lg2) 9900 else 4250
        val bitMark = if (lg2) 480 else 550
        val one = if (lg2) 1580 else 1600
        val zero = 550
        val p = ArrayList<Int>(60)
        p.add(hdrMark); p.add(hdrSpace)
        for (i in 27 downTo 0) {
            p.add(bitMark)
            p.add(if ((code shr i) and 1 == 1) one else zero)
        }
        p.add(bitMark)
        p.add(50_000)
        return p.toIntArray()
    }

    const val CARRIER_HZ = 38_000
}
