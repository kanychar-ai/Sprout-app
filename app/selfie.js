/* Sprout — guided selfie / liveness. Shows a face circle, walks the user through
 * blink / turn-left / turn-right prompts with a progress ring, then AUTO-captures
 * and shows a preview to confirm or retake. Device-photo fallback when no camera.
 * (Prompts are a scripted UX cue; real face/liveness ML would plug in here.) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('selfieStage'); if (!stage) return;

  var video = $('selfieVideo'), shot = $('selfieShot'), msg = $('selfieMsg'), prompt = $('selfiePrompt'),
      prog = $('selfieProg'), review = $('selfieReview'), retakeBtn = $('selfieRetake'),
      useBtn = $('selfieUse'), file = $('selfieFile'), manual = $('selfieManual');

  var shotData = null, pending = null, stream = null, canFilm = false, timer = null;

  var STEPS = [
    { ico: '🙂', msg: 'Position your face in the circle' },
    { ico: '👁️', msg: 'Blink your eyes' },
    { ico: '⬅️', msg: 'Slowly turn your head left' },
    { ico: '➡️', msg: 'Now turn your head right' }
  ];

  function setText(el, t) { if (el) el.textContent = t; }
  function setPrompt(t) { setText(prompt, t); }
  function setProgress(pct) { if (prog) prog.style.background = 'conic-gradient(var(--cobalt) ' + pct + '%, rgba(37,99,235,.15) 0)'; }
  function showToast(m) { if (window.SproutToast) window.SproutToast(m); }
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function startCamera() {
    if (stream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { useFileMode('Camera not available — take a selfie photo instead'); return; }
    setText(msg, 'Starting camera…'); msg.hidden = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false })
      .then(function (s) {
        stream = s; canFilm = true; video.srcObject = s; video.hidden = false;
        stage.classList.add('live'); if (manual) manual.hidden = true;
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        setText(msg, 'Follow the prompts — we capture automatically');
        runLiveness();
      })
      .catch(function () { useFileMode('Camera blocked — take a selfie photo instead'); });
  }
  function stopCamera() {
    clearTimer();
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (video) video.srcObject = null;
    stage.classList.remove('live'); canFilm = false;
  }
  function useFileMode(m) {
    canFilm = false; clearTimer();
    if (video) video.hidden = true; stage.classList.remove('live'); setProgress(0);
    setText(msg, m || ''); setPrompt('Take a selfie'); if (manual) manual.hidden = false;
  }

  // scripted liveness prompts, then auto-capture
  function runLiveness() {
    clearTimer();
    stage.classList.remove('shot'); shot.hidden = true;
    var i = 0; setProgress(0);
    (function next() {
      if (i >= STEPS.length) { setPrompt('✓ Hold still…'); setProgress(100); timer = setTimeout(autoCapture, 700); return; }
      var s = STEPS[i]; setPrompt(s.ico + '  ' + s.msg); setProgress(Math.round(i / STEPS.length * 100));
      timer = setTimeout(function () { i++; next(); }, 1900);
    })();
  }
  function autoCapture() {
    if (!canFilm || !stream) return;
    var w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) { timer = setTimeout(autoCapture, 400); return; }   // camera still warming
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(video, 0, 0, w, h);                  // true (un-mirrored) image for ID matching
    enterReview(c.toDataURL('image/jpeg', 0.9));
  }
  function enterReview(d) {
    clearTimer();
    pending = d; shot.src = d; shot.hidden = false; if (video) video.hidden = true;
    stage.classList.remove('live'); stage.classList.add('shot');
    review.hidden = false; if (manual) manual.hidden = true;
    setPrompt('Preview your selfie'); setText(msg, 'Looks good? Use it, or retake.'); setProgress(100);
  }
  function retake() {
    pending = null; shot.hidden = true; shot.src = ''; stage.classList.remove('shot'); review.hidden = true;
    if (canFilm && stream) { video.hidden = false; stage.classList.add('live'); runLiveness(); }
    else startCamera();
  }

  if (manual) manual.addEventListener('click', function () { file.click(); });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { enterReview(rd.result); }; rd.readAsDataURL(f); file.value = '';
  });
  retakeBtn.addEventListener('click', retake);
  // "Use photo" confirms; navigation to income is handled by data-go + the step guard
  useBtn.addEventListener('click', function () { if (pending) shotData = pending; stopCamera(); });

  function onRoute() {
    if (location.hash !== '#selfie') { stopCamera(); return; }
    if (shotData) { enterReview(shotData); return; }     // returning after capture → show preview
    review.hidden = true; stage.classList.remove('shot'); shot.hidden = true;
    startCamera();
  }
  window.addEventListener('hashchange', onRoute);
  if (location.hash === '#selfie') onRoute();

  window.SproutSelfie = { getShot: function () { return shotData; }, reset: function () { shotData = null; } };
})();
