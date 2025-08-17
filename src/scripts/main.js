/*
Copyright 2019 Google LLC
Licensed under the Apache License, Version 2.0
*/
import 'babel-polyfill';

import Renderer from './renderer';
import AudioPlayer from './audio-player';
import PoseController from './pose-controller';

// 🔊 importăm Tone.js ca să putem debloca AudioContext
import Tone from 'tone';

import config from '../config.js';
import song from '../assets/song.json';
import samples from '../assets/samples.json';

class App {
  constructor(config) {
    this.config = config;

    this.state = {
      loaded: false,
      percentageLoaded: 0,
      calibrating: true,
      conducting: false,
      stopped: false,
      finished: false,
      graphicsLoaded: false
    };

    this._cameraPrefetched = false;

    this.renderer = new Renderer({
      state: this.state,
      songTitle: song.header.name,
      startCalibration: this.startCalibration.bind(this),
      restart: this.restart.bind(this),
      setGraphicsLoaded: this.setGraphicsLoaded.bind(this)
    });

    this.audioPlayer = new AudioPlayer({
      song: song,
      samples: samples,
      setInstrumentsLoaded: this.setInstrumentsLoaded.bind(this),
      setSongProgress: this.setSongProgress.bind(this),
      triggerAnimation: this.renderer.triggerAnimation.bind(this.renderer)
    });

    this.poseController = new PoseController({
      state: this.state,
      renderer: this.renderer,
      handleCalibration: this.handleCalibration.bind(this),
      setTempo: this.setTempo.bind(this),
      getBeatLength: this.audioPlayer.getBeatLength.bind(this.audioPlayer),
      setInstrumentGroup: this.audioPlayer.setInstrumentGroup.bind(this.audioPlayer),
      setVelocity: this.audioPlayer.setVelocity.bind(this.audioPlayer),
      stop: this.stop.bind(this),
      start: this.start.bind(this)
    });

    // === 1) Deblochează AudioContext pe primul gest (click/tap) ===
    const unlockAudio = async () => {
      try {
        if (Tone && Tone.context && Tone.context.state !== 'running') {
          await Tone.context.resume();
          // unele browsere vechi mai cer și un mic “ping”
          if (Tone.Transport && Tone.Transport.state !== 'started') {
            // nu pornim transportul, doar îl atingem
            Tone.Transport.seconds = Tone.Transport.seconds; // no-op touch
          }
          console.log('[Semi-Conductor] AudioContext resumed.');
        }
      } catch (e) {
        console.warn('[Semi-Conductor] AudioContext resume failed:', e?.message || e);
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { capture: true, once: false });
    window.addEventListener('keydown', unlockAudio, { capture: true, once: false });

    // === 2) Cere permisiunea camerei foarte devreme + la primul tap ===
    this._preflightCamera();
    window.addEventListener('pointerdown', () => this._preflightCamera(), { once: true });

    // === 3) Watchdog: dacă “loading” stă prea mult, împinge progresul ===
    // (nu sare peste încărcarea reală; doar împinge UI-ul dacă s-a blocat din permisiuni)
    setTimeout(() => {
      if (!this.state.loaded && this.state.percentageLoaded < 60) {
        console.warn('[Semi-Conductor] Loading watchdog: pushing progress...');
        this.setGraphicsLoaded();          // ca și cum grafica ar fi gata
        this.setInstrumentsLoaded(80);     // împingem un prag sigur
      }
    }, 5000);
  }

  // ===== Camera preflight =====
  async _preflightCamera() {
    if (this._cameraPrefetched) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this._cameraPrefetched = true;
      stream.getTracks().forEach(t => t.stop());
      console.log('[Semi-Conductor] Camera permission granted (preflight).');
    } catch (err) {
      console.warn('[Semi-Conductor] Camera preflight failed:', err && err.name);
    }
  }

  /* Called with percentage each time instrument samples loaded */
  setInstrumentsLoaded(percentage) {
    this.state.percentageLoaded = percentage;
    this.setLoadProgress();
  }

  /* Called once when graphics loaded */
  setGraphicsLoaded() {
    this.state.graphicsLoaded = true;
    this.setLoadProgress();
  }

  /* Combines load progress of both graphics & samples to make sure app is fully loaded before starting */
  setLoadProgress() {
    let percentage;
    if (!this.state.graphicsLoaded) {
      percentage = this.state.percentageLoaded - 20;
    } else {
      percentage = this.state.percentageLoaded;
    }

    this.renderer.renderLoadProgress(percentage);
    if (percentage >= 100) {
      this.state.loaded = true;
      this.audioPlayer.queueSong();
    }
  }

  setSongProgress(percentage) {
    this.renderer.renderSongProgress(percentage);
    if (percentage >= 99.9 && !this.state.finished) {
      this.state.finished = true;
      this.renderer.renderFinishPage();
    }
  }

  setTempo(tempo) {
    if (!(tempo > 0) || tempo === Infinity) return;
    this.renderer.renderTempo(tempo);
    this.audioPlayer.setTempo(tempo);
  }

  start() {
    this.state.stopped = false;
    this.audioPlayer.start();
  }

  stop() {
    this.state.stopped = true;
    this.audioPlayer.stop();
  }

  async startCalibration() {
    await this._preflightCamera();
    // asigură-te că audio e “running” când userul apasă Start
    if (Tone && Tone.context && Tone.context.state !== 'running') {
      try { await Tone.context.resume(); } catch (_) {}
    }
    if (!this.poseController.initialized) await this.poseController.initialize();
  }

  handleCalibration() {
    this.renderer.renderCalibrationSuccess();
    this.state.calibrating = false;

    setTimeout(() => {
      this.renderer.renderConductPage();
      setTimeout(async () => {
        await this.renderer.renderCountdown();
        this.state.conducting = true;
      }, 1000);
    }, 2000);
  }

  restart() {
    this.audioPlayer.restart();
    this.state.calibrating = true;
    this.state.stopped = false;
    this.state.conducting = false;
    this.state.finished = false;
  }
}

const app = new App(config);
