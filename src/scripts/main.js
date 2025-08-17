// src/scripts/main.js

import { initApp } from './app.js';

function unlockAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(function (e) {
          console.warn('[Semi-Conductor] AudioContext resume failed:', (e && e.message) ? e.message : e);
        });
      }
    }
  } catch (e) {
    console.warn('[Semi-Conductor] AudioContext init failed:', (e && e.message) ? e.message : e);
  }
}
window.addEventListener('pointerdown', unlockAudio, { capture: true, once: false });

function getCameraStream() {
  if (navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } else {
    return Promise.reject(new Error('getUserMedia not supported'));
  }
}

async function init() {
  try {
    const stream = await getCameraStream();
    const videoElement = document.querySelector('#camera');
    if (videoElement) {
      videoElement.srcObject = stream;
      await videoElement.play().catch(function (e) {
        console.warn('[Semi-Conductor] Video play failed:', (e && e.message) ? e.message : e);
      });
    }
  } catch (e) {
    console.error('[Semi-Conductor] Camera init failed:', (e && e.message) ? e.message : e);
  }
}

// bootstrap
document.addEventListener('DOMContentLoaded', function () {
  initApp();
  init();
});
