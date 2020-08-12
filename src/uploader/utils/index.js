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

import path from 'path';
import FileType from 'file-type/browser';
import { isSupported } from '@viero/common/media';

const walk = (entries) => Promise.all(
  entries.map((entry) => {
    // dnd is drag n drop
    // fip is file picker
    if (entry.isFile) {
      // Chrome dnd
      return new Promise((resolve) => entry.file((file) => resolve({ entry, file })));
    } if (entry.isDirectory) {
      // Chrome
      return new Promise((resolve) => entry.createReader()
        .readEntries((entryEntries) => walk(entryEntries).then((something) => resolve(something))));
    } if (entry.blob) {
      return {
        file: entry.blob,
        entry,
      };
    }
    // Chrome fip
    return {
      file: entry,
      entry: {
        name: entry.name,
        fullPath:
          entry.webkitRelativePath && entry.webkitRelativePath.length
            ? `/${entry.webkitRelativePath}`
            : `/${entry.name}`,
      },
    };
  }),
);

const flatten = (hierarchy) => hierarchy.reduce((acc, curr) => {
  if (Array.isArray(curr)) {
    acc.push(...flatten(curr));
  } else {
    acc.push(curr);
  }
  return acc;
}, []);

const recognise = (reps) => Promise.all(
  reps.map((rep) => new Promise((resolve) => {
    const extname = path.extname(rep.file.name);
    if (extname === '.srt' || extname === '.sub' || extname === '.idx') {
      // eslint-disable-next-line no-param-reassign
      rep.type = {
        ext: extname.substring(1),
        mime: 'text/plain',
      };
      resolve(rep);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const uint8 = new Uint8Array(reader.result);
      FileType.fromBuffer(uint8).then((type) => {
        // eslint-disable-next-line no-param-reassign
        rep.type = type;
        resolve(rep);
      });
    };
    reader.onerror = (err) => {
      // eslint-disable-next-line no-param-reassign
      rep.err = err;
      resolve(rep);
    };
    reader.readAsArrayBuffer(rep.file.slice(0, FileType.minimumBytes));
  })),
);

const collate = (reps) => {
  const error = [];
  const unsupported = [];
  const supported = [];
  reps.forEach((rep) => {
    if (rep.error) {
      error.push(rep);
    } else if (isSupported(rep.file.size, rep.type.mime, rep.type.ext)) {
      supported.push(rep);
    } else {
      unsupported.push(rep);
    }
  });
  return { error, unsupported, supported };
};

export {
  walk, flatten, recognise, collate,
};
