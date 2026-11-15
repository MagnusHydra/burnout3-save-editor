# Burnout 3: Takedown (Xbox): `Profile 1` save format, checksum and signature

Notes from editing a real Burnout 3: Takedown Xbox save and loading it in the
Takedawn PS5 port. Everything marked **confirmed** was tested in the game.
Everything marked **guess** was not tested.

## Where the save is

```
E:\UDATA\4541005B\<SaveID>\Profile 1      <- the save data (signed)
E:\UDATA\4541005B\<SaveID>\SaveMeta.xbx   <- UTF-16 text: Name=Profile 1, NoCopy=0/1
E:\UDATA\4541005B\SaveImage.xbx, TitleImage.xbx, TitleMeta.xbx   <- icons/title, not signed
```

- The title ID is `4541005B`.
- `<SaveID>` is a 12-hex-digit folder name, such as `57BD267AFF58`, and differs between saves.
- `NoCopy=1` only stops the Xbox dashboard from copying the save. It has nothing to do with the signature.

## File layout

`Profile 1` is always **59,904 bytes (0xEA00)**. All values are little-endian.

| Offset | Size | Contents |
|---|---|---|
| 0x0000 | u32 | `0x10` (constant in every save seen) |
| 0x0004 to 0xE2FF | | Record and best-time tables. Every entry holds an 18-byte UTF-16LE name of the record holder (8 chars + null). A new profile uses the placeholder name `#@\|^`. The most common entry is 28 bytes: name (18) + 3 × u16 + float. |
| 0xE300 to 0xE373 | | Settings (**guess**). 0xE334 to 0xE35F is 44 bytes, `0x0F` each in a new profile, probably the EA Trax playlist flags. |
| 0xE374 to 0xE80F | 0x49C | Profile block (see below) |
| **0xE810** | u32 | **Checksum** (see below) |
| 0xE814 to 0xE9EB | | Zero padding |
| **0xE9EC to 0xE9FF** | 20 | **Signature**: HMAC-SHA1 (see below) |

### Profile block (0xE374 to 0xE80F)

| Offset | Size | Contents |
|---|---|---|
| 0xE374 | u32 | Unknown, different in every profile (ID or seed?) |
| 0xE378 | float | Play time (units not confirmed) |
| **0xE37C** | 18 | **Profile name**, UTF-16LE, max 8 chars + null terminator. A new profile shows `BURNOUT`. **Confirmed.** |
| 0xE38E, 0xE3A0 | 18 each | `P1`, `P2`, probably multiplayer names (**guess**) |
| 0xE3B4 to 0xE57F | u32 each | Stat counters |
| 0xE580 to 0xE6A3 | | Mostly floats (stats, unidentified) |
| 0xE6A4 to 0xE6F3 | 20 × u32 | 20 counters, probably Takedown Target progress (**guess**) |
| 0xE6F4 | u32 | `0xFFFFFFFF` |
| **0xE6FA to 0xE7A6** | 173 × u8 | **World Tour event results**, one byte per event. `0xFF` = not played, `0x03` in 100% saves (gold) |
| **0xE7A7 to 0xE7BA** | 20 × u8 | **Signature Takedowns**, `1` = done. **Confirmed** (count matches Driver Details) |
| **0xE7BB to 0xE7C4** | 10 × u8 | **Crash Headlines**, `1` = done. **Confirmed** (count matches) |
| 0xE7C5 to 0xE807 | 67 × u8 | Zero in every save seen (one per car? **guess**) |
| 0xE808 to 0xE80E | | Unknown (`0xFF` in a new profile) |
| 0xE80F | u8 | Profile slot in use, `0` = used (from the Takedawn source) |

### The name is stored about 480 times

Changing only 0xE37C renames the profile, but every record you set also
stores your name in the tables at 0x0004 to 0xE2FF. To rename everywhere,
replace every 18-byte UTF-16LE name slot that holds the old name. Match the
exact bytes, including the null after the name, and keep each name to 8
characters.

## Unlocks are worked out from progress

The game works out unlocked cars from your progress every time it loads a
profile. Unlocked cars are not stored. **Confirmed:**

- Setting all 20 Signature Takedown bytes to `1` unlocked the **Oval Racer Special**.
- Raising these counters took Takedown Targets from 15/20 to 20/20. With all 4 Takedown Trophies, that unlocked the **Euro Circuit Racer** (67/67 cars):

  | Offset | Set to at least |
  |---|---|
  | 0xE3C0 | 1 |
  | 0xE3E4 | 2 |
  | 0xE4D4 | 2000 (probably total takedowns, for the 1,500 / 2,000 Champion targets; **guess**) |
  | 0xE548 | 9 |
  | 0xE6BC | 2 |
  | 0xE6C0 | 2 |
  | 0xE6C8 | 2 |

  These were all raised together. Which ones are needed individually wasn't tested.

## Checksum (0xE810)

A u32 at **0xE810**, holding the **sum of all little-endian u32 words from 0x0000 to 0xE80F** (14,852 words), mod 2³².
No CRC, no seed. **Confirmed** on four different saves.

```python
import struct
checksum = sum(struct.unpack_from('<14852I', data)) & 0xFFFFFFFF
struct.pack_into('<I', data, 0xE810, checksum)
```

If you change any byte before 0xE810 and don't update this, the game rejects the save even with a valid signature.

## Signature (last 20 bytes)

Bytes **0xE9EC to 0xE9FF** hold an HMAC-SHA1 over **0x0000 to 0xE9EB**. Burnout 3 uses
non-roamable ("no-roam") signing, so a console-specific key goes in too:

```
signature = HMAC-SHA1(key = HDDKey, msg = HMAC-SHA1(key = AuthKey, msg = bytes 0x0000..0xE9EB))
```

- **Real Xbox:**
  - `HDDKey` is the 16-byte hard-drive key of the Xbox that will load the save. It comes from that console's EEPROM, read with UnleashX, XBMC, ConfigMagic, or LiveInfo on an `EEPROM.bin`.
  - `AuthKey` is Burnout 3's title auth key. It's published in the XSavSig `resign.ini` entry in the [feudalnate resigners repo](https://github.com/feudalnate/Original-Xbox-Gamesave-Resigners/tree/master/Burnout-3).
  - This formula matches XSavSig's output. It wasn't tested on a real console here.
- **Takedawn (PS5/PC recompilation), with no console key or EEPROM configured:**
  - Both keys are **16 zero bytes**: `HMAC-SHA1(0, HMAC-SHA1(0, data))`.
  - **Confirmed:** saves made by the port match this, and edited saves signed this way load.
  - The port's own save import re-signs real Xbox saves this way automatically.

You can't recover the HDD key from a save. The signature is one-way.

## Editing order

1. Change the bytes you want.
2. Recalculate the **checksum** at 0xE810.
3. Recalculate the **signature**, which covers the checksum.

`b3sign.exe` and XSavSig only do step 3. A save edited and then only
re-signed shows as damaged or unusable. The editor (`index.html`) and
`tools/b3_fix.py` in this repo do steps 2 and 3.

## Sources

- [feudalnate/Original-Xbox-Gamesave-Resigners: Burnout-3](https://github.com/feudalnate/Original-Xbox-Gamesave-Resigners/tree/master/Burnout-3): `b3sign.exe` and the XSavSig entry.
- [xenophobentx/xboxrecomp `kernel_ps2save.c`](https://github.com/xenophobentx/xboxrecomp/blob/takedawn/src/kernel/kernel_ps2save.c): the 0xE810 checksum and the profile block layout, used by Takedawn's PS2-to-Xbox save converter.
- [griches/PS5_Burnout3](https://github.com/griches/PS5_Burnout3): the PS5 port.
- XSavSig 0.05 (Team X4 and PaulB): HMAC-SHA1 no-roam signing.
