
export class VieroWindowUtils {

  static createElement(tagName, options) {
    const element = document.createElement(tagName);
    if (options.classes && options.classes.length) {
      element.className = options.classes.join(' ');
    }
    if (options.attributes) {
      Object.keys(options.attributes).forEach((key) => element.setAttribute(key, options.attributes[key]));
    }
    if (options.styles) {
      Object.keys(options.styles).forEach((key) => element.style[key] = options.styles[key]);
    }
    if (options.properties) {
      Object.keys(options.properties).forEach((key) => element[key] = options.properties[key]);
    }
    if (options.container) {
      options.container.appendChild(element);
    }
    return element;
  }

  static remToPx(rem) {
    return rem * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  static pxToRem(px) {
    return px / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

}