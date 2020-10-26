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

import { VieroLog } from '@viero/common/log';

const log = new VieroLog('VieroUpdater');

export class VieroInstaller {
  static checkInstallOrUpdate() {
    return fetch('/_static/manifest')
      .then((res) => res.json())
      .then((manifest) => Promise.all([manifest, caches.open('/_static/manifest')]))
      .then(([manifest, cache]) => cache
        .matchAll()
        .then((responses) => {
          const pathnames = Object.keys(manifest).reduce((acc, pathname) => {
            const idx = responses.findIndex((response) => new URL(response.url).pathname === pathname);
            if (idx < 0) {
              // new item
              acc.push(pathname);
            } else {
              // existing item
              const [response] = responses.splice(idx, 1);
              if (response.headers.get('etag') === manifest[pathname].digest) {
                // no change
              } else {
                // must overwrite
                acc.push(pathname);
              }
            }
            return acc;
          }, []);
          return pathnames;
        }))
      .catch((err) => {
        if (log.isError()) log.error('checkInstallOrUpdate', err);
      });
  }

  static installOrUpdate(pathnames) {
    let prom;
    if (pathnames && pathnames.length) {
      prom = Promise.resolve(pathnames);
    } else {
      prom = this.checkInstallOrUpdate();
    }
    return prom
      .then((thePathNames) => Promise.all([thePathNames, caches.open('/_static/manifest')]))
      .then(([thePathNames, cache]) => Promise.all([thePathNames, cache.addAll(thePathNames)]))
      .then(([thePathNames]) => thePathNames);
  }
}
