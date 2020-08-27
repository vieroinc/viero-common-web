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

import { uuid } from '@viero/common/uid';
import { VieroOperationQueue } from '../opcue';
import { VieroPlatform } from '../platform';
import { emitEvent, onEvent } from '../event';

import {
  walk, flatten, recognise, collate,
} from './utils';
import { VieroChunkedUploader } from './chunked';

const DEFAULTS = {
  chunked: true,
};

const OPQUEUE = new VieroOperationQueue();
OPQUEUE.concurrency = 4;
// eslint-disable-next-line no-use-before-define
OPQUEUE.addEventListener(VieroOperationQueue.EVENT.IDLE, () => emitEvent(VieroUploader.EVENT.DID_BECOME_IDLE));

const repsToTouchables = (reps, omitPaths) => reps.map((rep) => {
  // eslint-disable-next-line no-param-reassign
  rep.lookupKey = uuid();
  const touchable = {
    lookupKey: rep.lookupKey,
    name: rep.entry.name,
    type: rep.type.mime,
    size: rep.file.size,
  };
  if (!omitPaths) {
    touchable.path = rep.entry.fullPath.substring(0, rep.entry.fullPath.length - rep.entry.name.length);
  }
  return touchable;
});

const makeRepsByLookupKey = (reps) => reps.reduce((acc, rep) => {
  acc[rep.lookupKey] = rep;
  return acc;
}, {});

const reduceToUploadables = (touchRes, repsByLookupKey) => Object.keys(touchRes).reduce((acc, lookupKey) => {
  const repFromTouch = touchRes[lookupKey];
  if (repFromTouch.type === 'file') {
    const repByPath = repsByLookupKey[lookupKey];
    acc.push({
      nodeId: repFromTouch.id,
      name: repByPath.entry.name,
      fullPath: repByPath.entry.fullPath,
      size: repByPath.file.size,
      mime: repByPath.type.mime,
      ext: repByPath.type.ext,
      ref: repByPath.file,
      token: repFromTouch.uploadToken,
    });
  }
  return acc;
}, []);

const patchRepsWithTouchResponse = (
  supported, touchRes,
) => reduceToUploadables(touchRes, makeRepsByLookupKey(supported));

class VieroUploader {
  static get minimumBytes() {
    return 4100;
  }

  static isIdle() {
    return OPQUEUE.operationsCount().total === 0;
  }

  static snapshot() {
    return OPQUEUE.operations;
  }

  static preProcess(items) {
    const entries = items.map((item) => {
      if (item.webkitGetAsEntry) {
        // Chrome drag n drop
        return item.webkitGetAsEntry();
      }
      // Chrome file picker of Blob
      return item;
    });

    return walk(entries)
      .then((hierarchical) => flatten(hierarchical))
      .then((flattened) => recognise(flattened))
      .then((recognised) => collate(recognised));
  }

  static preProcessedRepsToTouchables(preProcessedReps, omitPaths = true) {
    return repsToTouchables(preProcessedReps, omitPaths);
  }

  static generateUploadables(preProcessed, touchRes) {
    return patchRepsWithTouchResponse(preProcessed, touchRes);
  }

  /**
   * To process and enqueue files then start the upload process.
   * @param {*} parentNode
   * @param {*} items File object or an arbitrary object like: { blob: ..., name: 'x', fullPath: '/x' }
   * @param {*} opts
   */
  static enqueueFiles(parentNode, items, opts) {
    // eslint-disable-next-line no-param-reassign
    opts = { ...DEFAULTS, ...(opts || {}) };

    const parentNodeId = parentNode.id || parentNode;

    return this.preProcess(items).then((collated) => {
      if (collated.supported.length) {
        return VieroPlatform.touch(parentNodeId, repsToTouchables(collated.supported, false), (i, touchRes) => {
          const uploadables = patchRepsWithTouchResponse(collated.supported, touchRes);
          if (uploadables) {
            this.enqueueUploadables(uploadables, opts);
          }
        });
      }
      return Promise.reject(collated);
    });
  }

  /**
   * To enqueue direct uploadables then start the upload process.
   * @param {*} uploadables pre-processed uploadables that contain touched nodes
   * @param {*} opts
   */
  static enqueueUploadables(uploadables, opts) {
    let size = 0;

    uploadables
      .sort((a, b) => a.size - b.size)
      .forEach((uploadable) => {
        size += uploadable.size;
        const uploader = new VieroChunkedUploader(uploadable, opts);
        OPQUEUE.addOperation(uploader);
      });

    emitEvent(VieroUploader.EVENT.DID_ENQUEUE, { count: uploadables.length, size });
  }
}

VieroUploader.EVENT = {
  DID_ENQUEUE: 'VieroUploaderEventDidEnqueue',

  DID_START_PREPARING_FILE: 'VieroUploaderEventDidStartPreparingFile',
  DID_FINISH_PREPARING_FILE: 'VieroUploaderEventDidFinishPreparingFile',

  DID_START_UPLOADING_FILE: 'VieroUploaderEventDidStartUploadingFile',
  DID_PROGRESS_UPLOADING_FILE: 'VieroUploaderEventDidProgressUploadingFile',
  DID_FINISH_UPLOADING_FILE: 'VieroUploaderEventDidFinishUploadingFile',

  RETRYING: 'VieroUploaderEventRetrying',

  DID_BECOME_IDLE: 'VieroUploaderEventDidBecomeIdle',
};

const VCUE = VieroChunkedUploader.EVENT;
const VUE = VieroUploader.EVENT;

onEvent(VCUE.DID_START_PROBING, (evt) => emitEvent(VUE.DID_START_PREPARING_FILE, evt.detail));
onEvent(VCUE.DID_FINISH_PROBING, (evt) => emitEvent(VUE.DID_FINISH_PREPARING_FILE, evt.detail));
onEvent(VCUE.DID_START_UPLOADING, (evt) => emitEvent(VUE.DID_START_UPLOADING_FILE, evt.detail));
onEvent(VCUE.DID_START_UPLOADING_CHUNK, (evt) => emitEvent(VUE.DID_PROGRESS_UPLOADING_FILE, evt.detail));
onEvent(VCUE.DID_PROGRESS_UPLOADING_CHUNK, (evt) => emitEvent(VUE.DID_PROGRESS_UPLOADING_FILE, evt.detail));
onEvent(VCUE.DID_FINISH_UPLOADING_CHUNK, (evt) => emitEvent(VUE.DID_PROGRESS_UPLOADING_FILE, evt.detail));
onEvent(VCUE.RETRYING, (evt) => emitEvent(VUE.RETRYING, evt.detail));
onEvent(VCUE.DID_FINISH_UPLOADING, (evt) => emitEvent(VUE.DID_FINISH_UPLOADING_FILE, evt.detail));

export { VieroUploader };
