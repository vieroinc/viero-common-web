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

import { VieroError } from '@viero/common/error';

export class VieroWebComponent extends HTMLElement {
  /**
   * Registers the custom element in the customElement registry.
   */
  static register() {
    if (!this.is) {
      throw new VieroError('VieroWebComponent', 536647);
    }
    window.customElements.define(this.is, this);

    this._template = document.createElement('template');
    this._template.innerHTML = this.html;
  }

  /**
   * Subclasses MAY return an array of attribute names.
   * See: attributeChangedCallback(name, oldValue, newValue).
   */
  static get observedAttributes() {
    return [];
  }

  /**
   * Subclasses MUST return their tagname here.
   */
  static get is() {
    throw new VieroError('VieroWebComponent', 157080);
  }

  /**
   * Subclasses shall return the HTML code of the component as a string.
   */
  static get html() {
    return '';
  }

  constructor() {
    super();
    this._template = this.constructor._template.content.cloneNode(true);
    this.attachShadow({ mode: 'open' });
    this.attachShadow = () => {
      throw new VieroError('VieroWebComponent', 961851);
    };
    this.$ = Array.from(this._template.querySelectorAll('[id]')).reduce((acc, ele) => {
      acc[ele.id] = ele;
      return acc;
    }, {});
  }

  /**
   * Called each times upon attaching to DOM.
   * Always call super.connectedCallback() in your override.
   */
  connectedCallback() {
    this.shadowRoot.appendChild(this._template);
  }

  /**
   * Called each times upon detaching from DOM.
   * Always call super.disconnectedCallback() in your override.
   */
  disconnectedCallback() {
    // nop
  }

  /**
   * See: https://stackoverflow.com/questions/50995139/when-does-webcomponent-adoptedcallback-fire.
   * Always call super.adoptedCallback() in your override.
   */
  adoptedCallback() {
    // nop
  }

  /**
   *
   * @param {*} name the name of the attribute.
   * @param {*} oldValue the old value of the attribute or null if none.
   * @param {*} newValue the new value of the attribute or null if unset.
   * Always call super.attributeChangedCallback(name, oldValue, newValue) in your override.
   */
  // eslint-disable-next-line no-unused-vars
  attributeChangedCallback(name, oldValue, newValue) {
    // nop
  }
}
