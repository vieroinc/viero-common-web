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

import querystring from 'querystring';
import { VieroError } from '@viero/common/error';
import { emitEvent } from '../event';

let pendingConnectionsCount = 0;

const byteLengthOf = (string) => {
  let length = 0;
  for (let i = string.length - 1; i >= 0; i -= 1) {
    const code = string.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) {
      length += 1;
    } else if (code > 0x7ff && code <= 0xffff) {
      length += 2;
    }
    if (code >= 0xDC00 && code <= 0xDFFF) {
      // trail surrogate
      i -= 1;
    }
  }
  return length;
};

const beginCommunication = () => {
  const from = pendingConnectionsCount;
  pendingConnectionsCount += 1;
  const to = pendingConnectionsCount;
  if (from === 0 && to === 1) {
    // eslint-disable-next-line no-use-before-define
    emitEvent(VieroHttpClient.EVENT.COMMUNICATION_DID_BEGIN);
  }
};

const endCommunication = () => {
  const from = pendingConnectionsCount;
  pendingConnectionsCount -= 1;
  const to = pendingConnectionsCount;
  if (from === 1 && to === 0) {
    // eslint-disable-next-line no-use-before-define
    emitEvent(VieroHttpClient.EVENT.COMMUNICATION_DID_END);
  }
};

class VieroHttpClient {
  static http(url, options) {
    options = {
      cache: 'no-store',
      credentials: 'include',
      redirect: 'follow',
      mode: 'cors',
      headers: {},
      ...options,
    };
    if (options.body) {
      switch (options.headers['content-type']) {
        case 'application/x-www-form-urlencoded':
          options.body = querystring.stringify(options.body);
          break;
        default:
          options.headers['content-type'] = 'application/json';
          options.body = JSON.stringify(options.body);
          break;
      }
      options.headers['content-length'] = byteLengthOf(options.body);
    }
    beginCommunication();
    emitEvent(VieroHttpClient.EVENT.REQUEST_DID_BEGIN);
    return fetch(url, options).then((res) => Promise.all([res, res.text()])).then(([res, text]) => {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
      return { res, data };
    }).then((something) => {
      emitEvent(VieroHttpClient.EVENT.REQUEST_DID_END, { res: something.res });
      endCommunication();
      return something;
    })
      .catch((err) => {
        emitEvent(VieroHttpClient.EVENT.REQUEST_DID_FAIL, { err });
        endCommunication(this.notificationAdapter);
        throw new VieroError('VieroHttpClient', 497988, { [VieroError.KEY.ERROR]: err });
      });
  }

  static get(url, options = {}) {
    return this.http(url, { ...options, method: 'GET' });
  }

  static post(url, options = {}) {
    return this.http(url, { ...options, method: 'POST' });
  }

  static put(url, options = {}) {
    return this.http(url, { ...options, method: 'PUT' });
  }

  static delete(url, options = {}) {
    return this.http(url, { ...options, method: 'DELETE' });
  }
}

VieroHttpClient.EVENT = {
  COMMUNICATION_DID_BEGIN: 'VieroHttpClientEventCommunicationDidBegin',
  COMMUNICATION_DID_END: 'VieroHttpClientEventCommunicationDidEnd',
  REQUEST_DID_BEGIN: 'VieroHttpClientEventRequestDidBegin',
  REQUEST_DID_END: 'VieroHttpClientEventRequestDidEnd',
  REQUEST_DID_FAIL: 'VieroHttpClientEventRequestDidFail',
};

export { VieroHttpClient };
