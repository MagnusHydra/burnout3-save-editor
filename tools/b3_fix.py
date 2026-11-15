#!/usr/bin/env python3
"""Fix the checksum and signature of a Burnout 3: Takedown (Xbox) "Profile 1" save.

Run it after editing the save. It updates the u32 checksum at 0xE810 and then
the 20-byte HMAC-SHA1 signature at the end of the file.

  python b3_fix.py "Profile 1"                  # Takedawn port (zero keys)
  python b3_fix.py "Profile 1" --check          # only show current vs calculated
  python b3_fix.py "Profile 1" --hddkey <32 hex> --authkey <32 hex>   # real Xbox

A copy of the original is kept as "<file>.bak" the first time the file is changed.
"""
import argparse
import hashlib
import hmac
import os
import shutil
import struct
import sys

SIZE = 0xEA00     # 59,904 bytes
SUM_AT = 0xE810   # u32 checksum = sum of u32 words 0x0000..0xE80F
SIG_AT = SIZE - 20


def checksum(data):
    return sum(struct.unpack_from('<%dI' % (SUM_AT // 4), data)) & 0xFFFFFFFF


def signature(data, auth_key, hdd_key):
    inner = hmac.new(auth_key, bytes(data[:SIG_AT]), hashlib.sha1).digest()
    return hmac.new(hdd_key, inner, hashlib.sha1).digest()


def key(text, name):
    try:
        k = bytes.fromhex(text.replace(' ', '').replace('-', ''))
    except ValueError:
        sys.exit('%s is not hexadecimal' % name)
    if len(k) != 16:
        sys.exit('%s must be 32 hex digits (16 bytes)' % name)
    return k


def main():
    ap = argparse.ArgumentParser(description='Fix the checksum and signature of a Burnout 3 Xbox "Profile 1" save.')
    ap.add_argument('file')
    ap.add_argument('--hddkey', default='00' * 16, help='HDD key of the target Xbox (default: zeros, for the Takedawn port)')
    ap.add_argument('--authkey', default='00' * 16, help="Burnout 3's title auth key (default: zeros, for the Takedawn port)")
    ap.add_argument('--check', action='store_true', help='only show the values, do not write')
    a = ap.parse_args()

    hdd, auth = key(a.hddkey, '--hddkey'), key(a.authkey, '--authkey')
    with open(a.file, 'rb') as f:
        data = bytearray(f.read())
    if len(data) != SIZE:
        sys.exit('%s is %d bytes; a Burnout 3 "Profile 1" is %d' % (a.file, len(data), SIZE))

    old_sum = struct.unpack_from('<I', data, SUM_AT)[0]
    old_sig = bytes(data[SIG_AT:])
    new_sum = checksum(data)
    struct.pack_into('<I', data, SUM_AT, new_sum)
    new_sig = signature(data, auth, hdd)
    data[SIG_AT:] = new_sig

    print('checksum   current %08X  calculated %08X  %s' % (old_sum, new_sum, 'OK' if old_sum == new_sum else 'WRONG'))
    print('signature  current %s' % old_sig.hex().upper())
    print('           calc    %s  %s' % (new_sig.hex().upper(), 'OK' if old_sig == new_sig else 'WRONG'))

    if a.check:
        return
    if old_sum == new_sum and old_sig == new_sig:
        print('Nothing to change.')
        return
    bak = a.file + '.bak'
    if not os.path.exists(bak):
        shutil.copyfile(a.file, bak)
        print('Original kept as %s' % bak)
    with open(a.file, 'wb') as f:
        f.write(data)
    print('Fixed.')


if __name__ == '__main__':
    main()
