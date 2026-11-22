# Sony Speaker Remote (SA-D40 M2)

An Android IR remote for your Sony SA-D40 M2. It sends Sony SIRC infrared codes through the phone's built-in IR blaster, so it works on phones like the iQOO 15R.

## Get the APK

**Option A: GitHub, no PC needed**
1. Make a new GitHub repository and upload everything in this folder, including the hidden `.github` folder.
2. Open the **Actions** tab. The "Build APK" job starts by itself and takes about 3 minutes.
3. Open the finished run, download **SonySpeakerRemote-apk**, unzip it, and install `app-debug.apk` on your phone. You will need to allow installs from unknown sources.

**Option B: Android Studio on a PC**
Open this folder in Android Studio, then choose Build → Build APK(s). You can also connect the phone and press Run.

## Use it
- Point the top edge of the phone (where the IR blaster is) at the speaker's front panel.
- **Power, Vol −/+ and Mute** are set up already. If the speaker doesn't respond, tap **Code set** to switch between the 15-bit, 12-bit and 20-bit Sony variants.
- Hold Vol −/+ to keep changing the volume.
- **Long-press** any button to type its code yourself.
- **Code Finder:** use it to find codes for Input, Bluetooth, Bass and the other buttons. Start with address `30` (15-bit) and tap **Next + Send** until the speaker reacts, then tap **Save to button…**.

## Default codes
Nine code sets (A–I) taken from real Sony remotes in the Flipper IRDB database. Tap "Find my speaker" to step through them.
