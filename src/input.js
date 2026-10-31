import { clamp } from './utils.js';

const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  Space: 'jump',
  KeyE: 'item',
  KeyQ: 'drift',
  KeyC: 'ballcam',
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.jumpBuffer = 0;
    this.itemBuffer = 0;
    this.ballCam = true;
    this.stick = { x: 0, y: 0, active: false, pointerId: null };
    this.touch = { boost: false, jump: false, item: false };
    this.gamepad = { throttle: 0, steer: 0, boost: false, jump: false, item: false };
    this.prevPadJump = false;
    this.prevPadItem = false;
    this.callbacks = {};
    this.joystickEl = document.getElementById('joystick');
    this.knobEl = document.getElementById('stick-knob');
    this.bind();
  }

  on(name, fn) {
    this.callbacks[name] = fn;
  }

  bind() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) {
        if (KEY_MAP[event.code]) event.preventDefault();
        return;
      }
      const action = KEY_MAP[event.code];
      if (!action) return;
      event.preventDefault();
      if (action === 'pause') {
        this.callbacks.pause?.();
        return;
      }
      if (action === 'ballcam') {
        this.ballCam = !this.ballCam;
        this.callbacks.ballcam?.(this.ballCam);
        return;
      }
      if (action === 'confirm') {
        this.callbacks.confirm?.();
        return;
      }
      this.keys.add(action);
      if (action === 'jump') this.jumpBuffer = 0.14;
      if (action === 'item') this.itemBuffer = 0.14;
    });

    window.addEventListener('keyup', (event) => {
      const action = KEY_MAP[event.code];
      if (!action) return;
      event.preventDefault();
      this.keys.delete(action);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch.boost = false;
      this.touch.jump = false;
      this.touch.item = false;
      this.resetStick();
    });

    this.bindJoystick();
    this.bindButton('btn-boost', 'boost');
    this.bindButton('btn-jump', 'jump');
    this.bindButton('btn-item', 'item');

    // don't let the page scroll or zoom during play
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('#joystick, .touch-btn, #game')) e.preventDefault();
    }, { passive: false });
  }

  bindJoystick() {
    if (!this.joystickEl) return;
    const el = this.joystickEl;
    const knob = this.knobEl;
    const max = 43;

    const move = (event) => {
      if (event.pointerId !== this.stick.pointerId) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const len = Math.hypot(dx, dy);
      const clampedLen = Math.min(len, max);
      if (len > 0.001) {
        dx = (dx / len) * clampedLen;
        dy = (dy / len) * clampedLen;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / max;
      const ny = dy / max;
      this.stick.x = Math.abs(nx) < 0.16 ? 0 : nx;
      this.stick.y = Math.abs(ny) < 0.16 ? 0 : ny;
      this.stick.active = true;
    };

    const end = (event) => {
      if (event.pointerId !== this.stick.pointerId) return;
      this.resetStick();
    };

    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.stick.pointerId = event.pointerId;
      el.setPointerCapture?.(event.pointerId);
      move(event);
    });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  resetStick() {
    this.stick.x = 0;
    this.stick.y = 0;
    this.stick.active = false;
    this.stick.pointerId = null;
    if (this.knobEl) this.knobEl.style.transform = 'translate(0px, 0px)';
  }

  bindButton(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (event) => {
      event.preventDefault();
      el.setPointerCapture?.(event.pointerId);
      el.classList.add('active');
      this.touch[action] = true;
      if (action === 'jump') this.jumpBuffer = 0.14;
      if (action === 'item') this.itemBuffer = 0.14;
    };
    const release = (event) => {
      event.preventDefault();
      el.classList.remove('active');
      this.touch[action] = false;
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('pointerleave', (event) => {
      if (event.buttons === 0) release(event);
    });
  }

  pollGamepad() {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) {
      this.gamepad.throttle = 0;
      this.gamepad.steer = 0;
      this.gamepad.boost = false;
      this.gamepad.jump = false;
      this.gamepad.item = false;
      return;
    }
    const axes = pad.axes;
    const steer = Math.abs(axes[0] || 0) > 0.16 ? axes[0] : 0;
    const throttle = -(Math.abs(axes[1] || 0) > 0.16 ? axes[1] : 0);
    this.gamepad.steer = steer;
    this.gamepad.throttle = throttle;
    this.gamepad.boost = !!pad.buttons[7]?.pressed || !!pad.buttons[0]?.pressed;
    const jump = !!pad.buttons[0]?.pressed || !!pad.buttons[1]?.pressed;
    const item = !!pad.buttons[2]?.pressed || !!pad.buttons[3]?.pressed;
    if (jump && !this.prevPadJump) this.jumpBuffer = 0.14;
    if (item && !this.prevPadItem) this.itemBuffer = 0.14;
    this.prevPadJump = jump;
    this.prevPadItem = item;
    this.gamepad.jump = jump;
    this.gamepad.item = item;
  }

  update(dt) {
    this.pollGamepad();
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.itemBuffer = Math.max(0, this.itemBuffer - dt);
  }

  getControls() {
    const k = this.keys;
    const up = k.has('up') ? 1 : 0;
    const down = k.has('down') ? 1 : 0;
    const left = k.has('left') ? 1 : 0;
    const right = k.has('right') ? 1 : 0;

    let throttle = up - down;
    let steer = right - left;
    let boost = k.has('boost') || this.touch.boost;
    let jump = k.has('jump') || this.touch.jump || this.jumpBuffer > 0;
    let item = k.has('item') || this.touch.item || this.itemBuffer > 0;
    const drift = k.has('drift');

    if (this.stick.active) {
      throttle += -this.stick.y;
      steer += this.stick.x;
    }
    throttle += this.gamepad.throttle;
    steer += this.gamepad.steer;
    boost = boost || this.gamepad.boost;
    jump = jump || this.gamepad.jump || this.jumpBuffer > 0;
    item = item || this.gamepad.item || this.itemBuffer > 0;

    return {
      throttle: clamp(throttle, -1, 1),
      steer: clamp(steer, -1, 1),
      boost,
      jump,
      item,
      drift,
    };
  }
}
