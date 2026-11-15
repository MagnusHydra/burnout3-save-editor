# Burnout 3: Takedown save editor (Xbox / Takedawn)

A browser-based editor for the **Burnout 3: Takedown** Xbox save (`Profile 1`).
It works with saves from a real Xbox and from the **Takedawn** PS5/PC port.
It fixes the game's internal checksum and re-signs the file, so the game
accepts it.

**Open the editor: https://magnushydra.github.io/burnout3-save-editor/**. You can
also download this repo and open `index.html`. Everything runs in your
browser, and the save never leaves your computer.

## Why this exists

I couldn't get my original Xbox Burnout 3 save to load in Takedawn, the PS5
recompilation. Xbox signs Burnout 3 saves with a key that's unique to each
console, so a save from one machine doesn't work anywhere else. We had to
work out which keys the port signs with (all zeros, it turns out) and what
had to change in the file before it would load.

Then we found the game also keeps its own checksum at `0xE810`, which we
couldn't find documented anywhere. Main reason for this GitHub.

Nobody had made an editor for these saves, so this repo puts everything we
learned in one place. So others can find the information too.

## What it can edit

| | Status |
|---|---|
| Profile name, including your name on every record and best time | Confirmed in game |
| Stats: playing time, Burnout points, crash damage, takedowns, slams, race and crash events (offline and online), favorite vehicle, and longest oncoming and drift with their cars | Confirmed in game |
| Signature Takedowns (20). All 20 unlock the **Oval Racer Special** | Confirmed in game |
| Crash Headlines (10) | Count confirmed |
| Takedown Targets: raise the counters to complete all 20 (4 trophies), which unlocks the **Euro Circuit Racer** | Confirmed in game |
| World Tour events: set all 173 to `03` (the value 100% saves have) | Experimental |
| Raw stat counters, such as races per car and takedowns per track | Advanced |

The game works out unlocked cars from your progress each time it loads, so
completing the Signature Takedowns and Takedown Targets is enough to unlock
the last Special Series cars.

## How to use

1. **Back up your save.**
2. Copy `Profile 1` from `UDATA\4541005B\<SaveID>\`. On the Takedawn port it's
   under the port's user data.
3. Open the editor, load `Profile 1`, and make your changes.
4. Pick what to sign for:
   - **Takedawn port**, with no console key or EEPROM configured: nothing else needed.
   - **Real Xbox**: enter that console's HDD key and Burnout 3's AuthKey. The
     AuthKey is published in the
     [feudalnate resigner README](https://github.com/feudalnate/Original-Xbox-Gamesave-Resigners/tree/master/Burnout-3).
5. Click **Download fixed save** and put `Profile 1` back in the same folder.

## Command-line fix-up

To fix a save you edited by hand in a hex editor:

```
python tools/b3_fix.py "Profile 1"                 # Takedawn port
python tools/b3_fix.py "Profile 1" --check         # show current vs calculated
python tools/b3_fix.py "Profile 1" --hddkey <32 hex> --authkey <32 hex>   # real Xbox
```

It keeps a `Profile 1.bak` the first time it changes a file.

## Save format

See **[FORMAT.md](FORMAT.md)** for offsets, the checksum and the signature.
In short:

- `Profile 1` is 59,904 bytes.
- **Checksum:** a u32 at `0xE810`, the sum of the u32 words from `0x0000` to `0xE80F`.
- **Signature:** the last 20 bytes, `HMAC-SHA1(HDDKey, HMAC-SHA1(AuthKey, data))`. On the Takedawn port both keys are zero.
- Order: edit, then checksum, then signature.

## Credits

- [feudalnate/Original-Xbox-Gamesave-Resigners](https://github.com/feudalnate/Original-Xbox-Gamesave-Resigners): `b3sign` and the Burnout 3 signing keys.
- [xenophobentx/xboxrecomp](https://github.com/xenophobentx/xboxrecomp) (Takedawn): the checksum and profile layout, from its PS2-to-Xbox save converter.
- XSavSig by Team X4 and PaulB.

## License

[MIT](LICENSE). You're free to use, copy, modify and share this code.

Not affiliated with Electronic Arts or Criterion Games. Use at your own risk,
and keep backups.
