/**
 * Copyright 2017 Viero, Inc.
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

import SparkMD5 from 'spark-md5';
import Rusha from 'rusha';

import { VieroPlatform } from '../../platform';
import { emitEvent } from '../../event';
import {
  VieroUploaderCancelled, VieroUploaderFullyUploaded, VieroUploaderConflictError, VieroUploaderTechnicalError,
} from '../common';

const SLICE_LENGTH = 52428800;
const TARGET_SPEED = 100000;

class VieroChunkedUploader {
  constructor(uploadable, opts) {
    this._uploadable = uploadable;
    this._opts = opts;
    this._statCurrent = {
      at: Date.now(), elapsed: 0, size: 0, byteps: 0, bitps: 0,
    };
    this._statOverall = {
      chunks: 0, elapsed: 0, size: 0, skip: 0,
    };
    this._step = 'waiting';
  }

  get progress() {
    const totalSize = this._uploadable.size;
    const skipSize = this._statOverall.skip;
    const uploadableSize = totalSize - skipSize;
    const uploadedSize = this._statOverall.size + this._statCurrent.size;
    const remainingSize = uploadableSize - uploadedSize;

    const elapsedTime = this._statOverall.elapsed + this._statCurrent.elapsed;

    const byteps = uploadedSize / (elapsedTime / 1000.0);
    const bitps = byteps * 8;

    const progress = {
      speed: { byteps, bitps },
      totalSize,
      skipSize,
      uploadableSize,
      uploadedSize,
      remainingSize,

      elapsedTime,
      remainingTime: remainingSize / byteps,
      skipPercent: skipSize / totalSize,
      uploadedPercent: uploadedSize / totalSize,

      step: this._step,
      retryAt: this._retryAt,
    };
    return progress;
  }

  cancel() {
    this._cancelled = true;
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
      delete this._retryTimeout;
    }
    this._step = 'cancelling';
  }

  _checkCancelled() {
    if (this._cancelled) {
      if (this._retryTimeout) {
        clearTimeout(this._retryTimeout);
        delete this._retryTimeout;
      }
      this._step = 'cancelling';
      throw new VieroUploaderCancelled();
    }
  }

  start() {
    let prom;
    if (this._uploadable.token) {
      this._token = this._uploadable.token;
      prom = Promise.resolve();
    } else {
      prom = VieroPlatform.getLicenses([this._uploadable.nodeId], 'upload_token')
        .then((res) => {
          this._token = res.tokens[this._uploadable.nodeId];
        });
    }
    return prom
      .then(() => {
        this._checkCancelled();
        this._step = 'preparing';
        emitEvent(VieroChunkedUploader.EVENT.DID_START_PROBE, { uploader: this });
      })
      .then(() => this.fingerprintFile())
      .then((hashes) => this.probeFile({ hashes, chunks: [] }))
      .then((startIndex) => {
        this._checkCancelled();
        if (startIndex > -1) {
          emitEvent(VieroChunkedUploader.EVENT.DID_END_PROBE, { uploader: this });
          this._statOverall.skip = startIndex * SLICE_LENGTH;
          this._index = startIndex;
          this._step = 'uploading';
          emitEvent(VieroChunkedUploader.EVENT.DID_START_UPLOAD, { uploader: this });
          return this.upload();
        }
        return null;
      })
      .then((res) => {
        emitEvent(VieroChunkedUploader.EVENT.DID_END_UPLOAD, { uploader: this });
        return res;
      })
      .catch((err) => {
        if (err.code === 635766) {
          emitEvent(VieroChunkedUploader.EVENT.DID_END_UPLOAD, { uploader: this });
          return;
        }
        emitEvent(VieroChunkedUploader.EVENT.DID_END_UPLOAD, { uploader: this, err });
      });
  }

  probeFile({ hashes, chunks, chunkPromises }) {
    this._checkCancelled();
    if (!chunkPromises) {
      const proms = [];
      const theChunkPromises = [];
      const numChunks = Math.ceil(this._uploadable.size / SLICE_LENGTH);
      for (let i = 0; i < numChunks; i += 1) {
        proms.push(() => {
          if (this._probed) {
            return Promise.resolve();
          }
          return this.hashForChunk({ index: i });
        });
      }
      this.promiseSerial(proms, false, theChunkPromises);
      return this.probeFile({ hashes, chunks, chunkPromises: theChunkPromises });
    }
    return this.callProbe({ hashes, chunks, token: this._token }).then((res) => {
      if (res.needMoreChunks) {
        const index = chunks.length;
        return chunkPromises[index].then(([md5, sha1]) => {
          chunks.push(`${md5}_${sha1}`);

          return this.probeFile({ hashes, chunks, chunkPromises });
        });
      }
      if (res.fullyUploaded) {
        throw new VieroUploaderFullyUploaded();
      }
      this._probed = true;
      return res.firstChunk;
    });
  }

  fingerprintFile() {
    this._checkCancelled();
    const intervals = [];
    for (let i = 0; i < this._uploadable.size; i += SLICE_LENGTH) {
      intervals.push([i, i + 65536]);
    }

    const hashPromises = intervals.map(([a, b]) => new Promise((resolve) => {
      const slice = this._uploadable.ref.slice(a, Math.min(this._uploadable.size, b));
      const reader = new FileReader();
      reader.onloadend = () => {
        const md5 = new SparkMD5.ArrayBuffer();
        md5.append(reader.result);
        resolve(md5.end());
      };
      reader.readAsArrayBuffer(slice);
    }));

    return Promise.all(hashPromises);
  }

  hashForChunk({ index }) {
    this._checkCancelled();
    const md5 = new SparkMD5.ArrayBuffer();
    const sha1 = Rusha.createHash();
    return new Promise((resolve) => {
      const proms = [];
      const startTime = Date.now();
      const targetTimes = [startTime];
      const upper = Math.min(this._uploadable.size, (index + 1) * SLICE_LENGTH);
      let u = 1;
      for (let a = index * SLICE_LENGTH; a < upper; a += 1048576) {
        const b = Math.min(a + 1048576, upper);
        const stepTime = Math.round(((b - a) * 8.0) / TARGET_SPEED);
        targetTimes.push(targetTimes[u - 1] + stepTime);
        const k = u;
        u += 1;
        proms.push(() => new Promise((_resolve) => {
          const slice = this._uploadable.ref.slice(a, b);
          const reader = new FileReader();
          reader.onloadend = () => {
            md5.append(reader.result);
            sha1.update(reader.result);
            const waitTime = Math.max(0, targetTimes[k] - Date.now());
            setTimeout(() => {
              _resolve();
            }, waitTime);
          };
          reader.readAsArrayBuffer(slice);
        }));
      }
      this.promiseSerial(proms).then(() => {
        const md5Dig = md5.end();
        const sha1Dig = sha1.digest('hex');
        resolve([md5Dig, sha1Dig]);
      });
    });
  }

  promiseSerial(promiseWrappers, continueOnFail = false, promiseArray = undefined) {
    return promiseWrappers.reduce((promise, promiseWrapper, idx) => {
      const part = promise.then((result) => {
        let thePromise = promiseWrapper();
        if (continueOnFail) {
          thePromise = thePromise.catch(() => Promise.resolve(null));
        }
        return thePromise.then((res) => {
          result.push(res);
          return result;
        });
      });
      if (promiseArray) {
        promiseArray.push(
          part.then((r) => r[idx]),
        );
      }
      return part;
    }, Promise.resolve([]));
  }

  callProbe({ hashes, chunks, token }) {
    this._checkCancelled();
    const url = `${VieroPlatform.URL.API}/node/${this._uploadable.nodeId}/probe?token=${token}`;
    const payload = Buffer.from(JSON.stringify({ hashes, chunks }));
    // signalNetUseStart();
    return fetch(url, {
      method: 'PUT',
      cache: 'no-store',
      redirect: 'follow',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'chunk-size': SLICE_LENGTH,
        'x-upload-content-length': this._uploadable.size,
        'content-type': 'application/json',
        'content-length': payload.byteLength,
      },
      body: payload,
    })
      .catch((err) => {
        // signalNetUseEnd()
        throw err;
      })
      .then((res) => {
        // signalNetUseEnd()
        if (res.status !== 200) {
          throw new VieroUploaderTechnicalError();
        }
        return res.json();
      });
  }

  upload() {
    this._checkCancelled();
    const chunksCount = Math.floor((this._uploadable.size - 1) / SLICE_LENGTH) + 1;
    this._chunksCount = chunksCount;
    if (this._index >= chunksCount) {
      this._isLast = true;
      // signalDone();
      return null;
    }

    const slice = this._uploadable.ref.slice(
      this._index * SLICE_LENGTH,
      Math.min(this._uploadable.size, (this._index + 1) * SLICE_LENGTH),
    );
    const min = Math.min(this._uploadable.size, (this._index + 1) * SLICE_LENGTH);
    const byteLength = min - this._index * SLICE_LENGTH;
    this._isLast = chunksCount - 1 === this._index;

    if (this._step !== 'cancelling') {
      this._step = 'uploading';
    }
    emitEvent(VieroChunkedUploader.EVENT.DID_START_UPLOAD_CHUNK, { uploader: this });
    return this.uploadChunk({
      contentType: this._uploadable.mime,
      data: slice,
      size: byteLength,
      index: this._index,
      token: this._token,
    })
      .then(() => {
        emitEvent(VieroChunkedUploader.EVENT.DID_END_UPLOAD_CHUNK, { uploader: this });
        if (!this._isLast) {
          this._index += 1;
          this.upload();
        }
      })
      .catch((err) => {
        emitEvent(VieroChunkedUploader.EVENT.DID_END_UPLOAD_CHUNK, { uploader: this, err });
      });
  }

  uploadChunk({
    contentType, data, size, index, token, retryMs = 10000,
  }) {
    this._checkCancelled();
    const url = `${VieroPlatform.URL.API}/node/${this._uploadable.nodeId}/index/${index}/pipe?token=${token}`;

    let start;
    let xhr;

    return new Promise((resolve, reject) => {
      xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('loadstart', () => {
        start = Date.now();
      });
      xhr.upload.addEventListener('progress', (evt) => {
        if (!evt.lengthComputable) {
          return;
        }
        this._statCurrent = this.calculateStats(start, evt.loaded);
        if (this._step !== 'cancelling') {
          this._step = 'uploading';
        }
        emitEvent(VieroChunkedUploader.EVENT.DID_PROGRESS_UPLOAD_CHUNK, { uploader: this });
      });
      xhr.addEventListener('load', () => {
        if (xhr.status !== 200) {
          reject(xhr);
          return;
        }
        this._statCurrent = {
          at: Date.now(), elapsed: 0, size: 0, byteps: 0, bitps: 0,
        };
        const chunkStat = this.calculateStats(start, size);
        this._statOverall.chunks += 1;
        this._statOverall.elapsed += chunkStat.elapsed;
        this._statOverall.size += chunkStat.size;
        resolve(xhr);
      });
      xhr.addEventListener('error', () => {
        reject(xhr);
      });
      xhr.addEventListener('abort', () => {
        reject(xhr);
      });

      xhr.open('PUT', url, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('cache-control', 'no-store');
      xhr.setRequestHeader('expires', '0');
      xhr.setRequestHeader('pragma', 'no-store');
      xhr.setRequestHeader('content-type', 'application/octet-stream');
      // DISALLOWED BY XHR xhr.setRequestHeader('content-length', size);
      xhr.setRequestHeader('chunk-size', SLICE_LENGTH);
      xhr.setRequestHeader('x-upload-content-length', this._uploadable.size);
      xhr.setRequestHeader('x-upload-content-type', contentType);
      // signalNetUseStart();
      xhr.send(data);
    }).catch(() => {
      // signalNetUseEnd()
      // throw err;
      if (xhr.status === 409) {
        throw new VieroUploaderConflictError();
      }
      return new Promise((resolve, reject) => {
        this._step = 'retrying';
        this._retryAt = Date.now() + retryMs;
        emitEvent(VieroChunkedUploader.EVENT.RETRYING, { uploader: this });
        this._retryTimeout = setTimeout(() => {
          delete this._retryTimeout;
          // eslint-disable-next-line no-param-reassign
          retryMs = Math.min(retryMs * 2, 320000);
          this.uploadChunk({
            contentType, data, size, index, token, retryMs,
          })
            .then(() => resolve())
            .catch((err) => {
              reject(err);
            });
        }, retryMs);
      });
    });
  }

  calculateStats(start, size) {
    const at = Date.now();
    const elapsed = at - start;
    const byteps = size / (elapsed / 1000.0);
    const bitps = byteps * 8;
    return {
      at, elapsed, size, byteps, bitps,
    };
  }
}

VieroChunkedUploader.EVENT = {
  DID_START_PROBE: 'VieroChunkedUploaderEventDidStartProbe',
  DID_END_PROBE: 'VieroChunkedUploaderEventDidEndProbe',

  DID_START_UPLOAD: 'VieroChunkedUploaderEventDidStartUpload',

  DID_START_UPLOAD_CHUNK: 'VieroChunkedUploaderEventDidStartUploadChunk',
  DID_PROGRESS_UPLOAD_CHUNK: 'VieroChunkedUploaderEventDidProgressUploadChunk',
  DID_END_UPLOAD_CHUNK: 'VieroChunkedUploaderEventDidEndUploadChunk',

  RETRYING: 'VieroChunkedUploaderEventRetrying',

  DID_END_UPLOAD: 'VieroChunkedUploaderEventDidEndUpload',
};

export { VieroChunkedUploader };
