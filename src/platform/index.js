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

import * as Bluebird from 'bluebird';
import { VieroLog } from '@viero/common/log';
import { VieroError } from '@viero/common/error';
import { VieroHttpClient } from '../http';

const log = new VieroLog('VieroPlatform');

const CONFIGURATION = {
  URL: {},
  LANGUAGE: 'en',
  LOCALE: 'en-US',
  ACCESS_TOKEN: null,
};

const BATCH_SIZE = 50;

class VieroPlatform {
  /* --------------------------------------------------- */
  /* -- CONFIGURATION OVERRIDE AND DEPENDANT ----------- */
  /* --------------------------------------------------- */

  static configure({ api, img }) {
    CONFIGURATION.URL.API = api;
    CONFIGURATION.URL.IMG = img;
  }

  static get URL() {
    return CONFIGURATION.URL;
  }

  static get LOCALE() {
    return CONFIGURATION.LOCALE;
  }

  static get LANGUAGE() {
    return CONFIGURATION.LANGUAGE;
  }

  static switchToClosestEndpoint(dc) {
    const urlParts = ['/misc/hello'];
    if (dc) {
      urlParts.push(`/${dc}`);
    }
    return this.defaultHandler('get', urlParts.join(''))
      .catch((err) => {
        if (log.isWarning()) {
          log.warning('Could not determine closest endpoint', err);
        }
        return Promise.resolve();
      })
      .then((response) => {
        if (!response) {
          return;
        }
        if (response.addresses.length) {
          CONFIGURATION.URL.API = response.addresses[0].api;
          CONFIGURATION.URL.IMG = response.addresses[0].image;
        }
        if (response.locale) {
          CONFIGURATION.LOCALE = response.locale;
          if (response.locale && response.locale.length >= 2) {
            CONFIGURATION.LANGUAGE = response.locale.slice(0, 2);
          }
        }
      });
  }

  /* --------------------------------------------------- */
  /* -- AUTH OVERRIDE ---------------------------------- */
  /* --------------------------------------------------- */

  static setAccessToken(token) {
    if (token) {
      const type = typeof token;
      if ((type === 'object' || type === 'string') && !!token.toLowerCase && token.length) {
        CONFIGURATION.ACCESS_TOKEN = token;
        return true;
      }
    }
    CONFIGURATION.ACCESS_TOKEN = null;
    return false;
  }

  static isAccessTokenSet() {
    return !!CONFIGURATION.ACCESS_TOKEN;
  }

  /* --------------------------------------------------- */
  /* -- CORE BRANCHING --------------------------------- */
  /* --------------------------------------------------- */

  // Handles mlost of the responses in a generic manner
  static defaultHandler(method, url, headers, body) {
    if (this.isAccessTokenSet()) {
      if (url.indexOf('?') > -1) {
        // eslint-disable-next-line no-param-reassign
        url += `&token=${CONFIGURATION.ACCESS_TOKEN}`;
      } else {
        // eslint-disable-next-line no-param-reassign
        url += `?token=${CONFIGURATION.ACCESS_TOKEN}`;
      }
    }
    return VieroHttpClient[method](`${CONFIGURATION.URL.API}${url}`, { headers, body })
      .catch((err) => {
        throw new VieroError('VieroPlatform', 799861, {
          [VieroPlatform.KEY.URL]: url,
          [VieroError.KEY.ERROR]: err,
        });
      })
      .then(({ res, data }) => {
        switch (res.status) {
          case 200:
          case 201:
          case 202:
          case 204: {
            // ok (GET|POST|PUT|DELETE)
            return Promise.resolve(data);
          }
          case 401: // the user is not logged in anymore
          case 402: // the user has no activ subscription
          case 403: // the user has no suitable acces to the resource (to CRUD)
          default:
            // or anything else
            if (res.status >= 500) {
              throw new VieroError('VieroPlatform', 878991, {
                [VieroPlatform.KEY.STATUS]: res.status,
                [VieroPlatform.KEY.URL]: url,
              });
            }
            throw new VieroError('VieroPlatform', 367152, {
              [VieroPlatform.KEY.STATUS]: res.status,
              [VieroPlatform.KEY.URL]: url,
            });
        }
      });
  }

  static batchExecute(method, path, headers, payload, key, concurrency = 4, onBatchDone = () => { }) {
    const batch = payload[key];
    // eslint-disable-next-line no-param-reassign
    delete payload[key];
    const slices = [];
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const slice = batch.slice(i, i + BATCH_SIZE);
      if (slice.length) {
        slices.push(slice);
      }
    }
    return new Promise((resolve, reject) => {
      Bluebird.map(
        slices,
        (slice, i) => {
          const batchedPayload = { ...payload };
          batchedPayload[key] = slice;
          return this.defaultHandler(method, path, headers, batchedPayload).then((res) => {
            if (onBatchDone) {
              onBatchDone(i, res);
            }
            return res;
          });
        },
        { concurrency },
      )
        .then(resolve)
        .catch(reject);
    });
  }

  /* --------------------------------------------------- */
  /* -- FILESYSTEM ------------------------------------- */
  /* --------------------------------------------------- */

  static touch(nodeId, files, onBatch = () => { }) {
    const size = files.reduce((acc, curr) => acc + curr.size, 0);
    return this.defaultHandler('get', `/node/quota/${size}`)
      .then(() => {
        this
          .batchExecute(
            'post',
            `/node/${nodeId}/touch`,
            {},
            { files, confirmed: true },
            'files',
            1,
            (i, result) => onBatch(i, result),
          );
      })
      .then((results) => {
        const merged = {};
        results.forEach((res) => Object.assign(merged, res));
        return merged;
      });
  }

  /* --------------------------------------------------- */
  /* -- LICENSE ---------------------------------------- */
  /* --------------------------------------------------- */

  static getLicenses(nodeIds, type) {
    return this.defaultHandler('post', '/node/license', {}, { nodeIds, type });
  }
}

VieroPlatform.KEY = {
  URL: 'VieroPlatformKeyUrl',
  STATUS: 'VieroPlatformKeyStatus',
};

export { VieroPlatform };
