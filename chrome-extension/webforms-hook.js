// WebForms MAIN world script to observe ASP.NET asynchronous postbacks
(function () {
  function hookPageRequestManager() {
    if (window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager) {
      try {
        var prm = window.Sys.WebForms.PageRequestManager.getInstance();
        if (prm && !prm._agrHooked) {
          prm.add_beginRequest(function (sender, args) {
            window.dispatchEvent(new CustomEvent('IGR_ASYNC_POSTBACK_START'));
          });
          prm.add_endRequest(function (sender, args) {
            var err = args && typeof args.get_error === 'function' ? args.get_error() : null;
            window.dispatchEvent(
              new CustomEvent('IGR_ASYNC_POSTBACK_END', {
                detail: { error: err ? err.message : null },
              })
            );
          });
          prm._agrHooked = true;
          console.log('[IGR Extension] Hooked Sys.WebForms.PageRequestManager');
        }
      } catch (e) {
        console.warn('[IGR Extension] Error hooking PageRequestManager:', e);
      }
    }
  }

  hookPageRequestManager();
  var count = 0;
  var timer = setInterval(function () {
    count++;
    hookPageRequestManager();
    if (count > 25 || (window.Sys && window.Sys.WebForms)) {
      clearInterval(timer);
    }
  }, 250);
})();
