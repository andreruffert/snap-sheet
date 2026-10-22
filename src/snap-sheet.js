const SUPPORTS_ANIMATION_TIMELINE = CSS.supports('animation-timeline: scroll()');

const TEMPLATE = document.createElement('template');

TEMPLATE.innerHTML = `
<dialog data-part="dialog">
  <div data-part="sentinel" aria-hidden="true"></div>

    <section data-part="panel"></section>

</dialog>
`;

/**
 * @typedef {'programmatic' | 'command' | 'gesture' | 'backdrop' | 'escape'} SheetCloseReason
 */

/**
 * Modal sheet with stacked-sheet management, scroll-based dismissal,
 * focus restoration, and optional scroll-driven animations.
 *
 * @fires SnapSheet#sheet-open
 * @fires SnapSheet#sheet-close
 */
export class SnapSheet extends HTMLElement {
  static define(tagName = 'snap-sheet', registry = customElements) {
    if (!registry.get(tagName)) {
      registry.define(tagName, SnapSheet);
    }

    return SnapSheet;
  }

  /** Open sheets ordered from bottom to top. */
  static stack = [];

  static #nextId = 0;

  #dialog = null;
  #panel = null;
  #timelineName = `--sheet-progress-${++SnapSheet.#nextId}`;
  #listeners = null;
  #previousFocus = null;

  /** @type {SheetCloseReason | null} */
  #pendingCloseReason = null;

  // -----------------------------------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------------------------------

  static get observedAttributes() {
    return ['open'];
  }

  connectedCallback() {
    this.#initializeDOM();
    this.#setupListeners();

    if (this.hasAttribute('open')) {
      this.show();
    }
  }

  disconnectedCallback() {
    this.#listeners?.abort();
    this.#listeners = null;

    if (this.open) this.#dialog.close();

    const index = SnapSheet.stack.indexOf(this);

    if (index !== -1) {
      SnapSheet.stack.splice(index, 1);
      SnapSheet.updateStack();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || name !== 'open') return;

    if (newValue !== null) {
      this.show();
    } else {
      this.close();
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------------------------------

  /**
   * Whether the sheet is currently open.
   *
   * @type {boolean}
   */
  get open() {
    return this.hasAttribute('open');
  }

  /** @param {boolean} value */
  set open(value) {
    if (value) {
      this.show();
    } else {
      this.close();
    }
  }

  /**
   * Opens the sheet.
   *
   * @param {Element | null} [invoker=null] Element to restore focus to on close.
   */
  show(invoker = null) {
    if (!this.isConnected || this.open || SnapSheet.stack.includes(this)) return;

    this.#previousFocus = invoker || document.activeElement;
    this.#dialog.showModal();

    SnapSheet.stack.push(this);
    SnapSheet.updateStack();

    requestAnimationFrame(() => {
      if (!this.open || !this.isConnected) return;
      this.#panel.scrollIntoView({ container: 'nearest' });
    });

    this.toggleAttribute('open', true);

    this.dispatchEvent(
      new CustomEvent('sheet-open', {
        bubbles: true,
        composed: true,
        detail: { invoker },
      }),
    );
  }

  /**
   * Requests that the topmost sheet close.
   *
   * @param {SheetCloseReason} [reason='programmatic']
   *   Reason included in the close event's detail.
   */
  close(reason = 'programmatic') {
    if (!this.open || SnapSheet.stack.at(-1) !== this) return;

    this.#pendingCloseReason = reason;

    if (this.#dialog.scrollTop < 1) {
      this.#completeClose(reason);
    } else {
      this.#dialog.scrollTop = 0;
    }
  }

  // -----------------------------------------------------------------------------------------------
  // DOM setup
  // -----------------------------------------------------------------------------------------------

  #initializeDOM() {
    if (this.#dialog) return;

    const fragment = TEMPLATE.content.cloneNode(true);
    this.#dialog = fragment.querySelector('[data-part="dialog"]');
    this.#panel = fragment.querySelector('[data-part="panel"]');

    if (SUPPORTS_ANIMATION_TIMELINE) {
      this.#dialog.style.setProperty('scroll-timeline-name', this.#timelineName);
      this.#dialog.style.setProperty('--sheet-progress-timeline', this.#timelineName);
    }

    for (const attr of ['label', 'labelledby', 'describedby']) {
      if (this.hasAttribute(attr)) {
        this.#dialog.setAttribute(`aria-${attr}`, this.getAttribute(attr));
      }
    }

    this.#panel.append(...this.childNodes);
    this.appendChild(fragment);
  }

  #setupListeners() {
    this.#listeners?.abort();
    this.#listeners = new AbortController();

    const options = { signal: this.#listeners.signal };

    this.addEventListener('command', this.#onCommand, options);
    this.#dialog.addEventListener('click', this.#onDialogClick, options);
    this.#dialog.addEventListener('cancel', this.#onDialogCancel, options);
    this.#dialog.addEventListener('scrollend', this.#onScrollEnd, options);
  }

  // -----------------------------------------------------------------------------------------------
  // Close lifecycle
  // -----------------------------------------------------------------------------------------------

  /**
   * @param {SheetCloseReason} reason
   */
  #completeClose(reason) {
    if (!this.open || SnapSheet.stack.at(-1) !== this) return;

    this.#pendingCloseReason = null;

    this.#dialog.close();
    SnapSheet.stack.pop();
    SnapSheet.updateStack();

    const target = this.#previousFocus;
    this.#previousFocus = null;

    if (target?.isConnected) {
      target.focus({ preventScroll: true });
    }

    this.toggleAttribute('open', false);

    this.dispatchEvent(
      new CustomEvent('sheet-close', {
        bubbles: true,
        composed: true,
        detail: { reason },
      }),
    );
  }

  // -----------------------------------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------------------------------

  #onCommand = (event) => {
    switch (event.command) {
      case '--open-sheet':
        this.show(event.source);
        break;
      case '--close-sheet':
        this.close('command');
        break;
    }
  };

  #onDialogClick = (event) => {
    if (event.target === this.#dialog) {
      this.close('backdrop');
    }
  };

  #onDialogCancel = (event) => {
    event.preventDefault();
    this.close('escape');
  };

  #onScrollEnd = () => {
    if (!this.open || this.#dialog.scrollTop >= 1) return;

    this.#completeClose(this.#pendingCloseReason ?? 'gesture');
  };

  // -----------------------------------------------------------------------------------------------
  // Stack and animation management
  // -----------------------------------------------------------------------------------------------

  /**
   * Synchronizes stacked-state attributes and animation timelines.
   * Each sheet receives timelines for the sheets stacked above it.
   */
  static updateStack() {
    const stack = SnapSheet.stack;

    for (let i = 0; i < stack.length; i++) {
      const sheet = stack[i];
      const { style } = sheet.#panel;
      const timelines = stack.slice(i + 1).map((next) => next.#timelineName);

      const stacked = timelines.length > 0;
      sheet.toggleAttribute('data-stacked', stacked);

      if (!stacked || !SUPPORTS_ANIMATION_TIMELINE) {
        style.removeProperty('animation-name');
        style.removeProperty('animation-timeline');
        continue;
      }

      style.setProperty(
        'animation-name',
        timelines.map(() => 'var(--sheet-stack-animation)').join(', '),
      );

      style.setProperty('animation-timeline', timelines.join(', '));
    }
  }
}
