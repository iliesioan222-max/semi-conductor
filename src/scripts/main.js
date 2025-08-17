import * as posenet from '@tensorflow-models/posenet';
import Stats from 'stats.js';
import dom from './dom';
import orchestra from './orchestra';

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

let net;
let video;
let rafId;

async function setupCamera() {
  video = document.getElementById('video');
  if (!video) {
    video = document.createElement('video');
    video.id = 'video';
    video.width = 600;
    video.height = 500;
    video.autoplay = true;
    video.playsInline = true;
    document.body.appendChild(video);
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: 600,
      height: 500
    }
  });

  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadPosenet() {
  net = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: { width: 600, height: 500 },
    multiplier: 0.75
  });
}

async function detectPose() {
  stats.begin();

  const pose = await net.estimateSinglePose(video, {
    flipHorizontal: true
  });

  dom.drawPose(pose, video);
  orchestra.update(pose);

  stats.end();
  rafId = requestAnimationFrame(detectPose);
}

async function main() {
  await setupCamera();
  await loadPosenet();

  video.play();

  detectPose();

  // Unlock AudioContext on user interaction
  const unlockAudio = () => {
    try {
      if (orchestra.audioCtx && orchestra.audioCtx.state === 'suspended') {
        orchestra.audioCtx.resume();
      }
    } catch (e) {
      console.warn(
        '[Semi-Conductor] AudioContext resume failed:',
        (e && e.message) ? e.message : e
      );
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { capture: true, once: false });
}

main();

window.onbeforeunload = () => {
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
};
