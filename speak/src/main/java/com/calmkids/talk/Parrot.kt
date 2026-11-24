package com.calmkids.talk

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Waits for the child to speak, records just that bit (nothing is saved),
 * and optionally plays it back higher and faster, like a parrot.
 */
class Parrot {
    private val rate = 16_000
    private val frame = 320 // 20 ms
    @Volatile private var running = false
    @Volatile private var token = 0
    private var worker: Thread? = null

    var onPlay: (() -> Unit)? = null

    fun stop() {
        token++
        running = false
    }

    fun release() = stop()

    /** callback(voiced, durationMs) is called once, from a background thread. */
    @SuppressLint("MissingPermission")
    fun capture(maxWaitMs: Int, playBack: Boolean, callback: (Boolean, Int) -> Unit) {
        stop()
        val my = ++token
        running = true
        worker = Thread {
            var voiced = false
            var durationMs = 0
            var rec: AudioRecord? = null
            try {
                val minBuf = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                rec = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, rate,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, max(minBuf, frame * 8))
                if (rec.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("mic busy")
                rec.startRecording()

                val buf = ShortArray(frame)
                val pre = ArrayDeque<ShortArray>()          // ~300 ms kept before the voice starts
                val clip = ArrayList<ShortArray>()
                var noise = 0.0
                var frames = 0
                var silentFrames = 0
                val maxFrames = maxWaitMs / 20
                val maxClipFrames = 4000 / 20

                while (running && my == token && frames < maxFrames) {
                    val n = rec.read(buf, 0, frame)
                    if (n <= 0) continue
                    frames++
                    var sum = 0.0
                    for (i in 0 until n) sum += buf[i].toDouble() * buf[i]
                    val rms = sqrt(sum / n)
                    if (frames <= 15) { noise += (rms - noise) / frames; continue } // learn the room noise first (average)
                    val threshold = max(700.0, noise * 2.2).coerceAtMost(6000.0)

                    if (!voiced) {
                        pre.addLast(buf.copyOf(n)); if (pre.size > 15) pre.removeFirst()
                        if (rms > threshold) { voiced = true; clip.addAll(pre) }
                    } else {
                        clip.add(buf.copyOf(n))
                        silentFrames = if (rms > threshold * 0.6) 0 else silentFrames + 1
                        if (silentFrames > 40 || clip.size > maxClipFrames) break // 0.8 s quiet or 4 s long
                    }
                }
                rec.stop()

                if (voiced && my == token) {
                    val total = clip.sumOf { it.size }
                    durationMs = total * 1000 / rate
                    if (playBack && total > 0) {
                        val pcm = ShortArray(total)
                        var o = 0
                        for (c in clip) { System.arraycopy(c, 0, pcm, o, c.size); o += c.size }
                        play(pcm, my)
                    }
                }
            } catch (_: Exception) {
                voiced = false
            } finally {
                try { rec?.release() } catch (_: Exception) {}
            }
            if (my == token) {
                running = false
                callback(voiced, durationMs)
            }
        }.also { it.start() }
    }

    @Suppress("DEPRECATION")
    private fun play(pcm: ShortArray, my: Int) {
        if (my != token) return
        val playRate = (rate * 1.45).toInt() // higher + faster = parrot voice
        val track = AudioTrack(AudioManager.STREAM_MUSIC, playRate, AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT, pcm.size * 2, AudioTrack.MODE_STATIC)
        try {
            // gentle volume boost, clipped safely
            var peak = 1
            for (s in pcm) peak = max(peak, kotlin.math.abs(s.toInt()))
            val gain = (20000.0 / peak).coerceIn(1.0, 4.0)
            for (i in pcm.indices) pcm[i] = (pcm[i] * gain).toInt().coerceIn(-32000, 32000).toShort()

            track.write(pcm, 0, pcm.size)
            onPlay?.invoke()
            track.play()
            val ms = pcm.size * 1000L / playRate
            var waited = 0L
            while (waited < ms + 150 && my == token) { Thread.sleep(50); waited += 50 }
            track.stop()
        } catch (_: Exception) {
        } finally {
            track.release()
        }
    }
}
