/* Sprout — selfie / liveness capture (front camera). Captures one selfie after
 * the ID scan, with a device-photo fallback. Exposes window.SproutSelfie.getShot(). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('selfieStage'); if (!stage) return;

  var video = $('selfieVideo'), shot = $('selfieShot'), msg = $('selfieMsg'),
      capBtn = $('selfieCapture'), review = $('selfieReview'),
      retakeBtn = $('selfieRetake'), useBtn = $('selfieUse'), file = $('selfieFile');

  var shotData = null;   // confirmed selfie (data URL)
  var pending = null;    // data URL awaiting "Use photo"
  var stream = null, canFilm = false, camTried = false;

  function setText(el, t) { if (el) el.textContent = t; }
  function showToast(m) { if (window.SproutToast) window.SproutToast(m); }

  function startCamera() {
    if (stream) return;
    camTried = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { useFileMode('Camera not supported — use a photo instead'); return; }
    setText(msg, 'Starting camera…'); msg.hidden = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false })
      .then(function (s) {
        stream = s; canFilm = true;
        video.srcObject = s; video.hidden = false;
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        stage.classList.add('live'); setText(msg, '● Detecting face…');
      })
      .catch(function () { useFileMode('Camera blocked — tap to use a photo instead'); });
  }
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (video) video.srcObject = null;
    stage.classList.remove('live'); camTried = false;
  }
  function useFileMode(m) { canFilm = false; if (video) video.hidden = true; stage.classList.remove('live'); setText(msg, m || 'Tap capture to use a photo'); }

  function captureLive() {
    var w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) { showToast('Camera still warming up — try again'); return; }
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(video, 0, 0, w, h);
    enterReview(c.toDataURL('image/jpeg', 0.9));
  }
  function enterReview(d) {
    pending = d; shot.src = d; shot.hidden = false;
    if (video) video.hidden = true; stage.classList.remove('live'); stage.classList.add('shot');
    capBtn.hidden = true; review.hidden = false; setText(msg, 'Looks good? Use it or retake.');
  }
  function exitReview() {
    pending = null; shot.hidden = true; shot.src = ''; stage.classList.remove('shot');
    review.hidden = true; capBtn.hidden = false;
    if (canFilm && video) { video.hidden = false; stage.classList.add('live'); setText(msg, '● Detecting face…'); }
    else setText(msg, 'Tap capture to use a photo');
  }

  capBtn.addEventListener('click', function () { if (canFilm && stream) captureLive(); else file.click(); });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { enterReview(rd.result); }; rd.readAsDataURL(f); file.value = '';
  });
  retakeBtn.addEventListener('click', exitReview);
  // "Use photo" confirms the selfie; navigation to income is handled by data-go
  useBtn.addEventListener('click', function () { if (pending) shotData = pending; stopCamera(); });

  // start/stop the camera as the customer enters/leaves the selfie screen
  function onRoute() {
    if (location.hash === '#selfie') { if (!shotData) exitReview(); startCamera(); }
    else stopCamera();
  }
  window.addEventListener('hashchange', onRoute);
  if (location.hash === '#selfie') onRoute();

  window.SproutSelfie = {
    getShot: function () { return shotData; },
    reset: function () { shotData = null; exitReview(); }
  };
})();
