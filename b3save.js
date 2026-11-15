/*
 * Burnout 3: Takedown (Xbox) "Profile 1" save: reading, editing, checksum and signature.
 * Works in the browser (window.B3Save) and in Node (require('./b3save.js')).
 * Format notes: FORMAT.md
 */
(function (root) {
  'use strict';

  var SIZE = 0xEA00;            // every Profile 1 is 59,904 bytes
  var SUM_AT = 0xE810;          // u32 sum of the u32 words 0x0000..0xE80F
  var SIG_AT = SIZE - 20;       // HMAC-SHA1 over 0x0000..0xE9EB
  var NAME_AT = 0xE37C;         // profile name, UTF-16LE, 8 chars + null
  var NAME_BYTES = 18;
  var NAME_MAX = 8;
  var EVENTS_AT = 0xE6FA, EVENTS = 173;
  var SIG_TAKEDOWNS_AT = 0xE7A7, SIG_TAKEDOWNS = 20;
  var HEADLINES_AT = 0xE7BB, HEADLINES = 10;
  // Raising these together took Takedown Targets from 15/20 to 20/20 (all 4 trophies).
  var TARGET_COUNTERS = [[0xE3C0, 1], [0xE3E4, 2], [0xE4D4, 2000], [0xE548, 9], [0xE6BC, 2], [0xE6C0, 2], [0xE6C8, 2]];
  var COUNTER_RANGES = [[0xE3B4, 0xE57C], [0xE6A4, 0xE6F0]];
  var ZERO_KEY = new Uint8Array(16);

  function sha1(msg) {
    var len = msg.length;
    var padded = ((len + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(padded);
    m.set(msg);
    m[len] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(padded - 8, Math.floor(len / 0x20000000));
    dv.setUint32(padded - 4, (len << 3) >>> 0);
    var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    var w = new Uint32Array(80);
    for (var off = 0; off < padded; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 80; i++) { var x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
      var a = h0, b = h1, c = h2, d = h3, e = h4;
      for (i = 0; i < 80; i++) {
        var f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        var t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
        e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    var out = new Uint8Array(20), odv = new DataView(out.buffer);
    odv.setUint32(0, h0); odv.setUint32(4, h1); odv.setUint32(8, h2); odv.setUint32(12, h3); odv.setUint32(16, h4);
    return out;
  }

  function hmacSha1(key, msg) {
    if (key.length > 64) key = sha1(key);
    var inner = new Uint8Array(64 + msg.length), outer = new Uint8Array(64 + 20);
    for (var i = 0; i < 64; i++) {
      var kb = i < key.length ? key[i] : 0;
      inner[i] = kb ^ 0x36;
      outer[i] = kb ^ 0x5C;
    }
    inner.set(msg, 64);
    outer.set(sha1(inner), 64);
    return sha1(outer);
  }

  function u32(buf, at) { return (buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16) | (buf[at + 3] << 24)) >>> 0; }
  function setU32(buf, at, v) { buf[at] = v & 0xFF; buf[at + 1] = (v >>> 8) & 0xFF; buf[at + 2] = (v >>> 16) & 0xFF; buf[at + 3] = (v >>> 24) & 0xFF; }

  function hex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16).toUpperCase();
    return s;
  }

  function parseKey(text) {
    var clean = String(text || '').replace(/[\s:-]/g, '');
    if (!/^[0-9a-fA-F]{32}$/.test(clean)) return null;
    var k = new Uint8Array(16);
    for (var i = 0; i < 16; i++) k[i] = parseInt(clean.substr(i * 2, 2), 16);
    return k;
  }

  function checksum(buf) {
    var s = 0;
    for (var i = 0; i < SUM_AT; i += 4) s = (s + u32(buf, i)) >>> 0;
    return s;
  }

  function signature(buf, authKey, hddKey) {
    return hmacSha1(hddKey || ZERO_KEY, hmacSha1(authKey || ZERO_KEY, buf.subarray(0, SIG_AT)));
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function check(buf, authKey, hddKey) {
    var stored = buf.slice(SIG_AT);
    var sig = signature(buf, authKey, hddKey);
    return {
      storedChecksum: u32(buf, SUM_AT),
      checksum: checksum(buf),
      checksumOk: u32(buf, SUM_AT) === checksum(buf),
      storedSignature: hex(stored),
      signature: hex(sig),
      signatureOk: sameBytes(stored, sig)
    };
  }

  // Writes the checksum, then the signature (which covers the checksum).
  function fix(buf, authKey, hddKey) {
    setU32(buf, SUM_AT, checksum(buf));
    buf.set(signature(buf, authKey, hddKey), SIG_AT);
    return buf;
  }

  function readName(buf, at) {
    var s = '';
    for (var i = 0; i < NAME_MAX + 1; i++) {
      var c = buf[at + i * 2] | (buf[at + i * 2 + 1] << 8);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  function nameError(name) {
    if (!name.length) return 'The name cannot be empty.';
    if (name.length > NAME_MAX) return 'The name can be at most ' + NAME_MAX + ' characters.';
    if (!/^[\x20-\x7E]+$/.test(name)) return 'Use plain letters, digits and common symbols only.';
    return null;
  }

  // Record-table slots (before 0xE300) that hold exactly `name`, plus whether the new name fits in each.
  function recordSlots(buf, name, newLength) {
    var pat = [];
    for (var i = 0; i < name.length; i++) { pat.push(name.charCodeAt(i) & 0xFF, name.charCodeAt(i) >> 8); }
    pat.push(0, 0);
    var slots = [];
    for (var at = 4; at + NAME_BYTES <= 0xE300; at += 2) {
      var hit = true;
      for (var j = 0; j < pat.length; j++) if (buf[at + j] !== pat[j]) { hit = false; break; }
      if (!hit) continue;
      // Skip matches inside a longer name: the two bytes before must not be a UTF-16 character.
      var prev = buf[at - 2], prevHi = buf[at - 1];
      if (prevHi === 0 && prev >= 0x20 && prev <= 0x7E) continue;
      var need = Math.max(name.length, newLength || 0) * 2 + 2;
      var fits = need <= NAME_BYTES;
      for (var z = name.length * 2; fits && z < need; z++) if (buf[at + z] !== 0) fits = false;
      slots.push({ at: at, fits: fits });
    }
    return slots;
  }

  function writeName(buf, at, name, clearBytes) {
    for (var i = 0; i < clearBytes; i++) buf[at + i] = 0;
    for (var j = 0; j < name.length; j++) { buf[at + j * 2] = name.charCodeAt(j) & 0xFF; buf[at + j * 2 + 1] = name.charCodeAt(j) >> 8; }
  }

  // Renames the profile; with `everywhere`, also every record that holds the old name.
  function rename(buf, newName, everywhere) {
    var err = nameError(newName);
    if (err) throw new Error(err);
    var old = readName(buf, NAME_AT);
    var result = { profile: true, records: 0, skipped: 0 };
    if (everywhere && old.length) {
      recordSlots(buf, old, newName.length).forEach(function (s) {
        if (!s.fits) { result.skipped++; return; }
        writeName(buf, s.at, newName, Math.max(old.length, newName.length) * 2 + 2);
        result.records++;
      });
    }
    writeName(buf, NAME_AT, newName, NAME_BYTES);
    return result;
  }

  function flags(buf, at, count) {
    var out = [];
    for (var i = 0; i < count; i++) out.push(buf[at + i] === 1);
    return out;
  }

  function setFlags(buf, at, values) {
    for (var i = 0; i < values.length; i++) buf[at + i] = values[i] ? 1 : 0;
  }

  function counters(buf) {
    var out = [];
    COUNTER_RANGES.forEach(function (r) {
      for (var at = r[0]; at <= r[1]; at += 4) out.push({ at: at, value: u32(buf, at) });
    });
    return out;
  }

  function eventSummary(buf) {
    var counts = {};
    for (var i = 0; i < EVENTS; i++) { var v = buf[EVENTS_AT + i]; counts[v] = (counts[v] || 0) + 1; }
    return counts;
  }

  function info(buf) {
    var sig = flags(buf, SIG_TAKEDOWNS_AT, SIG_TAKEDOWNS), head = flags(buf, HEADLINES_AT, HEADLINES);
    return {
      name: readName(buf, NAME_AT),
      signatureTakedowns: sig,
      headlines: head,
      events: eventSummary(buf),
      targetsRaised: TARGET_COUNTERS.every(function (t) { return u32(buf, t[0]) >= t[1]; }),
      port: check(buf, ZERO_KEY, ZERO_KEY)
    };
  }

  var api = {
    SIZE: SIZE, SUM_AT: SUM_AT, SIG_AT: SIG_AT, NAME_AT: NAME_AT, NAME_MAX: NAME_MAX,
    EVENTS_AT: EVENTS_AT, EVENTS: EVENTS, SIG_TAKEDOWNS_AT: SIG_TAKEDOWNS_AT, SIG_TAKEDOWNS: SIG_TAKEDOWNS,
    HEADLINES_AT: HEADLINES_AT, HEADLINES: HEADLINES, TARGET_COUNTERS: TARGET_COUNTERS,
    sha1: sha1, hmacSha1: hmacSha1, hex: hex, parseKey: parseKey, u32: u32, setU32: setU32,
    checksum: checksum, signature: signature, check: check, fix: fix,
    readName: readName, nameError: nameError, recordSlots: recordSlots, rename: rename,
    flags: flags, setFlags: setFlags, counters: counters, eventSummary: eventSummary, info: info
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.B3Save = api;
})(this);
