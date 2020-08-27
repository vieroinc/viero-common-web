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

import { EventTarget } from 'event-target-shim';

const execNext = (queue) => {
  // eslint-disable-next-line no-underscore-dangle
  const running = queue._running;
  // eslint-disable-next-line no-underscore-dangle
  const waiting = queue._waiting;
  if (queue.concurrency <= running.length) {
    return;
  }
  const def = waiting.shift();
  if (!def) {
    return;
  }
  running.push(def);
  const prom = def.op.start();
  const next = () => {
    const idx = running.findIndex((it) => it.idx === def.idx);
    running.splice(idx, 1);
    if (queue.idle) {
      // eslint-disable-next-line no-use-before-define
      queue.dispatchEvent(new CustomEvent(VieroOperationQueue.EVENT.IDLE));
      return;
    }
    execNext(queue);
  };
  if (prom.then && prom.catch) {
    prom.catch(() => undefined).then(next);
  } else {
    next();
  }
};

class VieroOperationQueue extends EventTarget {
  constructor() {
    super();

    this._concurrency = 1;
    this._idx = 0;
    this._waiting = [];
    this._running = [];
  }

  set concurrency(concurrency) {
    if (!Number.isFinite(concurrency)) {
      return;
    }
    // eslint-disable-next-line no-param-reassign
    concurrency = Math.floor(concurrency);
    // eslint-disable-next-line no-param-reassign
    concurrency = Math.max(this._concurrency, concurrency);
    if (concurrency !== this._concurrency) {
      this._concurrency = concurrency;
      execNext(this);
    }
  }

  get concurrency() {
    return this._concurrency;
  }

  get idle() {
    return this.operationsCount() === 0;
  }

  get operations() {
    return {
      running: [...this._running],
      waiting: [...this._waiting],
    };
  }

  addOperation(op) {
    this._idx += 1;
    const ref = this._idx;
    this._waiting.push({ op, ref });
    execNext(this);
    return ref;
  }

  cancelOperation(ref) {
    const idx = this._waiting.findIndex((it) => it.ref === ref);
    if (idx < 0) {
      return;
    }
    this._waiting.splice(idx, 1);
  }

  operationsCount() {
    return this._waiting.length + this._running.length;
  }
}

VieroOperationQueue.EVENT = {
  IDLE: 'VieroOperationQueueEventIdle',
};

export { VieroOperationQueue };
