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

import { VieroWebComponent } from '../webcomponent';

class VieroApp extends VieroWebComponent {
  static get html() {
    return `
      <style>
        .container {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
        }
      </style>
      <div id="container" class="container">
        <div id="app" class="container"></div>
        <div id="modal" class="container"></div>
        <div id="dropdown" class="container"></div>
        <div id="popup" class="container"></div>
      </div>
    `;
  }

  constructor() {
    super();
    this._container = Array.from(this.$.container.children).reduce((acc, ele) => {
      acc[ele.id] = ele;
      return acc;
    }, {});
  }

  get container() {
    return { ...this._container };
  }
}

export { VieroApp };
