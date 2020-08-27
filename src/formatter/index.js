/**
 * Copyright 2020 Viero, Inc.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import filesize from 'filesize';
import fecha from 'fecha';
import { VieroPlatform } from '../platform';

const MILIS_IN_SEC = 1000;
const SECS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const SECS_IN_HOUR = SECS_IN_MINUTE * MINUTES_IN_HOUR;

const time = {
  ascending(ts) {
    if (!Number.isFinite(ts)) {
      return null;
    }
    const at = new Date(ts);
    return {
      date: fecha.format(at, 'YYYY-MM-DD'),
      time: fecha.format(at, 'HH:mm:ss'),
    };
  },

  browser(ts, options) {
    if (!Number.isFinite(ts)) {
      return null;
    }
    const opts = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      object: true,
      ...(options || {}),
    };
    const dateOpts = { ...(opts.year || {}), ...(opts.month || {}), ...(opts.day || {}) };
    const timeOpts = { ...(opts.hour || {}), ...(opts.minute || {}), ...(opts.second || {}) };
    const at = new Date(ts);
    if (opts.object) {
      return {
        date: at.toLocaleDateString(options.locale, dateOpts),
        time: at.toLocaleTimeString(options.locale, timeOpts),
      };
    }
    return at.toLocaleString(options.locale, { ...dateOpts, ...timeOpts });
  },

  platform(ts, options) {
    return time.browser(ts, { ...(options || {}), locale: VieroPlatform.LOCALE });
  },

  timeCode: (ms, options = {}) => {
    if (!Number.isFinite(ms)) {
      return null;
    }
    const milis = ms % MILIS_IN_SEC;
    let secs = Math.floor(ms / MILIS_IN_SEC);
    const hours = Math.floor(secs / SECS_IN_HOUR);
    if (hours) secs -= (hours * SECS_IN_HOUR);
    const minutes = Math.floor(secs / MINUTES_IN_HOUR);
    if (minutes) secs -= (minutes * MINUTES_IN_HOUR);
    if (options.compress) {
      if (hours) return `${hours}:${(`0${minutes}`).slice(-2)}:${(`0${secs}`).slice(-2)}`;
      if (minutes) return `${minutes}:${(`0${secs}`).slice(-2)}`;
      return `${secs}`;
    }
    const hhmmss = [['00', `${hours}`], ['00', `${minutes}`], ['00', `${secs}`]]
      .map((def) => (def[0] + def[1]).slice(-(Math.max(2, def[1].length)))).join(':');

    if (options.milis) return `${hhmmss}.${`000${milis}`.slice(-3)}`;
    return hhmmss;
  },
};

const size = {
  file(bytes, spec) {
    if (!Number.isFinite(bytes)) {
      return null;
    }
    switch (spec) {
      case size.SPEC.IEC:
      default: return filesize(bytes, { standard: 'iec', round: 2, output: 'object' });
    }
  },

  SPEC: {
    IEC: 'sizeSpecIEC',
  },
};

const speed = {
  bitrate(bps) {
    if (!Number.isFinite(bps)) {
      return null;
    }
    return {
      value: Number.parseInt(bps / 10000, 10) / 100,
      unit: 'mbps',
    };
  },
};

const formatter = {
  time, size, speed,
};

export {
  formatter,
};
