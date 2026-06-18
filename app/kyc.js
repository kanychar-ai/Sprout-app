/* Sprout — e-KYC ID capture: live camera, capture front & back, review/retake,
 * verify each side (SproutID), and view captured photos. Falls back to the device
 * photo picker when the camera isn't available, and never strands the user. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var stage = $('kycStage');
  if (!stage) return; // kyc screen not present

  var video = $('kycVideo'), shot = $('kycShot'), camMsg = $('kycCamMsg'),
      scan = $('kycScanline'), checks = $('kycChecks'), file = $('kycFile'),
      hint = $('kycHint'), capBtn = $('kycCapture'), review = $('kycReview'),
      retakeBtn = $('kycRetake'), useBtn = $('kycUse'), contBtn = $('kycContinue');

  var SIDES = ['front', 'back'];
  var shots = { front: null, back: null };
  var verified = { front: false, back: false };
  var current = 'front';
  var pending = null;       // data URL awaiting "Use photo"
  var stream = null;
  var canFilm = false;      // is a live camera usable?
  var camTried = false;     // have we attempted getUserMedia this visit?

  function setText(el, t) { if (el) el.textContent = t; }
  function showToast(m) { if (window.SproutToast) window.SproutToast(m); }

  // ---- camera lifecycle ----------------------------------------------------
  function startCamera() {
    if (stream) return;
    camTried = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { useFileMode('Camera not supported — use a photo instead'); return; }
    setText(camMsg, 'Starting camera…'); camMsg.hidden = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (s) {
        stream = s; canFilm = true;
        video.srcObject = s; video.hidden = false; if (scan) scan.hidden = false;
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        camMsg.hidden = true; if (checks) checks.hidden = false;
      })
      .catch(function () { useFileMode('Camera blocked — tap to use a photo instead'); });
  }
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (video) { video.srcObject = null; }
    camTried = false; // allow the camera to restart next time the screen is opened
  }
  function useFileMode(msg) {
    canFilm = false;
    if (video) video.hidden = true;
    if (scan) scan.hidden = true;
    if (checks) checks.hidden = true;
    setText(camMsg, msg || 'Tap capture to use a photo'); camMsg.hidden = false;
  }

  // ---- capture / review ----------------------------------------------------
  function captureLive() {
    var w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) { showToast('Camera still warming up — try again'); return; }
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(video, 0, 0, w, h);
    enterReview(c.toDataURL('image/jpeg', 0.9));
  }
  function enterReview(dataUrl) {
    pending = dataUrl;
    shot.src = dataUrl; shot.hidden = false;
    if (video) video.hidden = true;
    if (scan) scan.hidden = true; camMsg.hidden = true;
    capBtn.hidden = true; review.hidden = false; contBtn.hidden = true;
  }
  function exitReview() {
    pending = null; shot.hidden = true; shot.src = '';
    review.hidden = true;
    if (canFilm && video) { video.hidden = false; if (scan) scan.hidden = false; }
    else { camMsg.hidden = false; }
    refreshControls();
  }

  // ---- verification + state ------------------------------------------------
  function store(side, dataUrl, result) {
    shots[side] = dataUrl;
    verified[side] = !!(result && result.ok);
    var slot = $('slot' + side.charAt(0).toUpperCase() + side.slice(1));
    if (slot) {
      var th = slot.querySelector('.idslot-th');
      var st = slot.querySelector('.idslot-st');
      th.textContent = ''; th.style.backgroundImage = 'url(' + dataUrl + ')';
      slot.classList.toggle('done', verified[side]);
      slot.classList.toggle('bad', !verified[side]);
      st.textContent = verified[side] ? '✓ Verified' : '⚠ Retake';
      st.className = 'badge tiny idslot-st ' + (verified[side] ? 'ok' : 'amber');
    }
  }

  // setSide is the single entry point (used by the UI and by tests)
  function setSide(side, dataUrl) {
    setText(camMsg, 'Checking the ' + side + ' of your ID…'); camMsg.hidden = false;
    return window.SproutID.verify(side, dataUrl).then(function (res) {
      store(side, dataUrl, res);
      if (!res.ok) {
        showToast('That doesn\'t look like the ' + side + ' of an ID — please retake');
        current = side; // stay on this side
      } else if (side === 'front' && !verified.back) {
        current = 'back';
      }
      exitReview();
      return res;
    });
  }

  function bothDone() { return verified.front && verified.back; }

  function refreshControls() {
    review.hidden = true;
    if (bothDone()) {
      capBtn.hidden = true; contBtn.hidden = false; contBtn.disabled = false;
      setText(hint, 'Both sides verified. You\'re good to continue.');
      if (hint.querySelector) hint.innerHTML = 'Both sides verified ✓ — you\'re good to continue.';
      if (checks) checks.hidden = true;
      camMsg.hidden = true;
      stopCamera();
      return;
    }
    contBtn.hidden = true;
    capBtn.hidden = false;
    capBtn.textContent = '📷 Capture ' + current;
    hint.innerHTML = 'Place the <b>' + current + '</b> of your Thai national ID inside the frame. Hold steady.';
    if (!stream && !camTried) startCamera();
  }

  // ---- wiring --------------------------------------------------------------
  capBtn.addEventListener('click', function () {
    if (canFilm && stream) captureLive();
    else file.click(); // fall back to the device photo picker
  });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { enterReview(rd.result); };
    rd.readAsDataURL(f);
    file.value = '';
  });
  retakeBtn.addEventListener('click', exitReview);
  useBtn.addEventListener('click', function () {
    if (!pending) return;
    useBtn.disabled = true;
    setSide(current, pending).then(function () { useBtn.disabled = false; });
  });

  // tap a slot to view its captured photo (and retake)
  SIDES.forEach(function (side) {
    var slot = $('slot' + side.charAt(0).toUpperCase() + side.slice(1));
    if (slot) slot.addEventListener('click', function () { if (shots[side]) openViewer(side); });
  });

  function openViewer(side) {
    var lb = document.createElement('div');
    lb.className = 'id-lightbox';
    lb.innerHTML = '<button class="lb-close" aria-label="Close">✕</button>' +
      '<img src="' + shots[side] + '" alt="' + side + ' of ID">' +
      '<div class="lb-cap">' + side.charAt(0).toUpperCase() + side.slice(1) + ' · ' +
      (verified[side] ? '✓ verified' : '⚠ not verified') + ' — tap ✕ to close, then Retake to redo</div>';
    function close() { lb.remove(); }
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-close')) close(); });
    document.body.appendChild(lb);
  }

  // start/stop the camera as the customer enters/leaves the KYC screen
  function onRoute() {
    if (location.hash === '#kyc') { refreshControls(); }
    else { stopCamera(); }
  }
  window.addEventListener('hashchange', onRoute);
  if (location.hash === '#kyc') onRoute();

  // expose for the test suite (and as a programmatic capture hook)
  window.SproutKYC = { setSide: setSide, reset: function () {
    shots = { front: null, back: null }; verified = { front: false, back: false };
    current = 'front'; refreshControls();
  } };
})();
