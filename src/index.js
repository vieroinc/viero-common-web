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

export {
  VieroEventCenter, onEvent, offEvent, emitEvent,
} from './event';
export { formatter } from './formatter';
export { VieroHTTPWebClient } from './http';
export { VieroInstaller } from './installer';
export {
  inputMediaDevices,
  supportedConstraints,
  canGetUserStream,
  getUserStream,
  canGetDisplayStream,
  getDisplayStream,
  canRequestApprovalDialog,
  requestApprovalDialog,
} from './media';
export { VieroOperationQueue } from './opcue';
export { parser } from './parser';
export { VieroPlatform } from './platform';
export { VieroUploader } from './uploader';
