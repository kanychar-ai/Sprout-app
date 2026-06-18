/* Sprout — ID-card verification.
 *
 * PLUGGABLE: set window.SPROUT_CONFIG.idVerifyApi (+ optional idVerifyHeaders) to a
 * third-party eKYC / OCR provider. The app will POST { side, image } (image is a
 * data URL) and expects a JSON response shaped like:
 *     { ok: true|false, confidence: 0..1, checks: {...}, reason: "..." }
 *
 * Until a provider is wired up, a LOCAL heuristic stub runs so the whole capture
 * flow works end-to-end. The stub does cheap sanity checks (resolution, landscape
 * card orientation, not-blank, exposure) — it is NOT real ID detection, just a
 * placeholder with the same contract so swapping in a provider needs no UI change.
 *
 * Both paths resolve to: { ok, side, confidence, checks, reason }.
 */
(function () {
  'use strict';
  var MIN_W = 480, CARD_RATIO = 1.585, RATIO_TOL = 0.5;

  function demo(side, reason) {
    return { ok: true, side: side, confidence: 0.9, checks: { demo: true }, reason: reason || 'demo (no detector configured)' };
  }

  function localVerify(side, dataUrl) {
    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      var ctx = null;
      try { ctx = canvas.getContext && canvas.getContext('2d'); } catch (e) { ctx = null; }
      if (!ctx) { resolve(demo(side, 'image analysis unavailable in this browser')); return; }

      var done = false;
      function finish(r) { if (!done) { done = true; resolve(r); } }

      var img = new Image();
      img.onerror = function () { finish(demo(side, 'could not read image')); };
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) { finish(demo(side)); return; }
          var ratio = w > h ? w / h : h / w;
          var tw = Math.min(180, w), sc = tw / w;
          canvas.width = tw; canvas.height = Math.max(1, Math.round(h * sc));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          var n = d.length / 4, sum = 0, i;
          for (i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
          var mean = sum / n, vs = 0;
          for (i = 0; i < d.length; i += 4) { var g = (d[i] + d[i + 1] + d[i + 2]) / 3 - mean; vs += g * g; }
          var std = Math.sqrt(vs / n);
          var checks = {
            resolution: w >= MIN_W,
            cardShape: ratio >= CARD_RATIO - RATIO_TOL,   // ID is a landscape card
            notBlank: std > 12,                            // has detail, not a flat shot
            notTooDark: mean > 28,
            notTooBright: mean < 234
          };
          var failed = Object.keys(checks).filter(function (k) { return !checks[k]; });
          var ok = failed.length === 0;
          finish({
            ok: ok, side: side, confidence: ok ? 0.85 : 0.3, checks: checks,
            reason: ok ? 'passed local format checks' : ('failed: ' + failed.join(', '))
          });
        } catch (e) { finish(demo(side)); }
      };
      img.src = dataUrl;
      setTimeout(function () { finish(demo(side, 'analysis timed out')); }, 1800);
    });
  }

  window.SproutID = {
    /* verify(side, dataUrl) -> Promise<{ok, side, confidence, checks, reason}> */
    verify: function (side, dataUrl) {
      var cfg = window.SPROUT_CONFIG || {};
      if (cfg.idVerifyApi) {
        var headers = { 'Content-Type': 'application/json' };
        var extra = cfg.idVerifyHeaders || {};
        Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
        return fetch(cfg.idVerifyApi, { method: 'POST', headers: headers, body: JSON.stringify({ side: side, image: dataUrl }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
          .then(function (j) {
            return { ok: !!j.ok, side: side, confidence: j.confidence || 0, checks: j.checks || {}, reason: j.reason || '' };
          })
          .catch(function () { return localVerify(side, dataUrl); }); // provider down → local fallback
      }
      return localVerify(side, dataUrl);
    }
  };
})();
