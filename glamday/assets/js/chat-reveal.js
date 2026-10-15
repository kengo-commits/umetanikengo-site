(function () {
  var style = document.createElement('style');
  style.textContent =
    'body:not(.chat-revealed) #chatbot-widget-button,' +
    'body:not(.chat-revealed) #chatbot-widget-container{' +
    'opacity:0!important;pointer-events:none!important;}';
  (document.head || document.documentElement).appendChild(style);

  function threshold() {
    var sales = document.getElementById('sales');
    if (sales) {
      var top = sales.getBoundingClientRect().top + (window.pageYOffset || 0);
      return Math.max(top - window.innerHeight * 0.85, window.innerHeight * 0.6);
    }
    return window.innerHeight * 0.95;
  }
  function update() {
    if ((window.pageYOffset || 0) > threshold()) {
      document.body.classList.add('chat-revealed');
    } else {
      document.body.classList.remove('chat-revealed');
    }
  }
  ['scroll', 'resize', 'load'].forEach(function (e) {
    window.addEventListener(e, update, { passive: true });
  });
  if (document.readyState !== 'loading') update();
  else document.addEventListener('DOMContentLoaded', update);
})();
