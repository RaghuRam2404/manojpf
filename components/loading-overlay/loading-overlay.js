(function () {
  var componentName = 'loading-overlay';

  if (customElements.get(componentName)) return;

  class LoadingOverlay extends HTMLElement {
    connectedCallback() {
      if (this.dataset.initialized) return;

      this.dataset.initialized = 'true';
      this.setAttribute('aria-live', 'polite');
      this.setAttribute('role', 'status');

      var label = this.getAttribute('label') || 'Loading';
      var logoSource = this.getAttribute('logo-src') || 'assets/Logos/manoj%20logo.svg';
      var logo = document.createElement('img');
      var indicator = document.createElement('div');

      logo.alt = label;
      logo.className = 'loading-overlay__logo';
      logo.src = logoSource;

      indicator.className = 'loading-overlay__indicator';
      indicator.setAttribute('aria-hidden', 'true');

      for (var index = 0; index < 3; index += 1) {
        var bar = document.createElement('span');
        bar.className = 'loading-overlay__bar';
        indicator.appendChild(bar);
      }

      this.replaceChildren(logo, indicator);
    }
  }

  customElements.define(componentName, LoadingOverlay);
})();