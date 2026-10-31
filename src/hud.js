import { ARENA, ITEMS, TEAM } from './constants.js';
import { clamp, formatTime, TAU } from './utils.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      scoreBlue: document.getElementById('score-blue'),
      scoreRed: document.getElementById('score-red'),
      clock: document.getElementById('clock'),
      clockLabel: document.getElementById('clock-label'),
      boostFill: document.getElementById('boost-fill'),
      boostNum: document.getElementById('boost-num'),
      speed: document.getElementById('speed'),
      itemWrap: document.getElementById('item-wrap'),
      itemSlot: document.getElementById('item-slot'),
      itemIcon: document.getElementById('item-icon'),
      itemName: document.getElementById('item-name'),
      touchItemIcon: document.getElementById('touch-item-icon'),
      touchItemBtn: document.getElementById('btn-item'),
      touchBoostBtn: document.getElementById('btn-boost'),
      touchBoostNum: document.getElementById('touch-boost-num'),
      message: document.getElementById('message'),
      messageMain: document.getElementById('message-main'),
      messageSub: document.getElementById('message-sub'),
      powerTag: document.getElementById('power-tag'),
      hitFlash: document.getElementById('hit-flash'),
      goalFlash: document.getElementById('goal-flash'),
      speedLines: document.getElementById('speed-lines'),
      minimap: document.getElementById('minimap'),
      touch: document.getElementById('touch-controls'),
      menu: document.getElementById('menu'),
      pause: document.getElementById('pause'),
      end: document.getElementById('end'),
      endTitle: document.getElementById('end-title'),
      endKicker: document.getElementById('end-kicker'),
      endBlue: document.getElementById('end-blue'),
      endRed: document.getElementById('end-red'),
      loading: document.getElementById('loading'),
      soundBtn: document.getElementById('sound-btn'),
    };
    this.ctx = this.el.minimap.getContext('2d');
    this.messageTimer = 0;
    this.messageToken = 0;
    this.lastScore = { blue: -1, red: -1 };
    this.callbacks = {};
    this.touchVisible = false;
    this.minimapTime = 0;
    this.bind();
  }

  on(name, fn) {
    this.callbacks[name] = fn;
  }

  bind() {
    const bind = (id, name) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', (event) => {
        event.preventDefault();
        this.callbacks[name]?.();
      });
    };
    bind('play-btn', 'play');
    bind('sound-btn', 'sound');
    bind('resume-btn', 'resume');
    bind('restart-btn', 'restart');
    bind('quit-btn', 'quit');
    bind('rematch-btn', 'rematch');
    bind('menu-btn', 'quit');
  }

  showLoading(show) {
    if (show) {
      this.el.loading.classList.remove('hidden', 'fade');
    } else {
      this.el.loading.classList.add('fade');
      setTimeout(() => this.el.loading.classList.add('hidden'), 500);
    }
  }

  showHUD(show) {
    this.el.hud.classList.toggle('hidden', !show);
    if (!show) this.el.touch.classList.add('hidden');
  }

  showTouch(show) {
    this.touchVisible = show;
    this.el.touch.classList.toggle('hidden', !show);
  }

  showMenu(show) {
    this.el.menu.classList.toggle('hidden', !show);
  }

  showPause(show) {
    this.el.pause.classList.toggle('hidden', !show);
  }

  showEnd(show) {
    this.el.end.classList.toggle('hidden', !show);
  }

  setSoundLabel(muted) {
    if (this.el.soundBtn) this.el.soundBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  setScore(blue, red) {
    if (blue !== this.lastScore.blue) {
      this.el.scoreBlue.textContent = blue;
      this.pulse(this.el.scoreBlue);
    }
    if (red !== this.lastScore.red) {
      this.el.scoreRed.textContent = red;
      this.pulse(this.el.scoreRed);
    }
    this.lastScore = { blue, red };
  }

  pulse(el) {
    el.animate(
      [{ transform: 'scale(1.55)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }],
      { duration: 420, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' }
    );
  }

  update(game) {
    const { score, timeLeft, player } = game;
    this.setScore(score.blue, score.red);
    this.el.clock.textContent = formatTime(timeLeft);
    this.el.clock.classList.toggle('low', timeLeft <= 30 && game.state === 'playing');
    this.el.clockLabel.textContent = game.overtime ? 'OVERTIME' : 'TIME';

    if (player) {
      const boost = Math.round(player.boost);
      this.el.boostFill.style.width = `${boost}%`;
      this.el.boostNum.textContent = boost;
      const kmh = Math.round(player.speed * 3.6);
      this.el.speed.textContent = kmh;
      this.updateItem(player);
      this.updatePower(player);
      this.el.speedLines.style.opacity = String(clamp((player.speed - 24) / 40, 0, 0.55));
      if (this.el.touchBoostBtn) this.el.touchBoostBtn.style.setProperty('--boost', String(boost));
      if (this.el.touchBoostNum) this.el.touchBoostNum.textContent = String(boost);
    }

    this.minimapTime += 1;
    if (this.minimapTime % 2 === 0) this.drawMinimap(game);
  }

  updateItem(player) {
    const type = player.item;
    if (type) {
      const meta = ITEMS[type];
      this.el.itemSlot.classList.add('has-item');
      this.el.itemIcon.textContent = meta.icon;
      this.el.itemName.textContent = meta.name;
      if (this.el.touchItemIcon) this.el.touchItemIcon.textContent = meta.icon;
      this.el.touchItemBtn?.classList.add('has-item');
    } else {
      this.el.itemSlot.classList.remove('has-item');
      this.el.itemIcon.textContent = '?';
      this.el.itemName.textContent = 'EMPTY';
      if (this.el.touchItemIcon) this.el.touchItemIcon.textContent = '?';
      this.el.touchItemBtn?.classList.remove('has-item');
    }
  }

  updatePower(player) {
    let text = '';
    let cls = '';
    if (player.starTime > 0) {
      text = `STAR POWER · ${player.starTime.toFixed(1)}s`;
      cls = 'star';
    } else if (player.shrinkTime > 0) {
      text = `SHRUNK · ${player.shrinkTime.toFixed(1)}s`;
      cls = 'shrink';
    } else if (player.boostTime > 0) {
      text = `MUSHROOM BOOST · ${player.boostTime.toFixed(1)}s`;
      cls = 'star';
    }
    if (text) {
      this.el.powerTag.textContent = text;
      this.el.powerTag.className = `power-tag show ${cls}`;
    } else {
      this.el.powerTag.className = 'power-tag';
    }
  }

  message(main, sub = '', cls = '', duration = 1.6) {
    const token = ++this.messageToken;
    this.el.messageMain.textContent = main;
    this.el.messageMain.className = `message-main ${cls}`;
    this.el.messageSub.textContent = sub;
    this.el.message.classList.add('show');
    this.messageTimer = duration;
    this.messageToken = token;
    clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      if (token === this.messageToken) this.el.message.classList.remove('show');
    }, duration * 1000);
  }

  flashHit() {
    this.el.hitFlash.classList.remove('flash-on');
    void this.el.hitFlash.offsetWidth;
    this.el.hitFlash.classList.add('flash-on');
  }

  flashGoal() {
    this.el.goalFlash.classList.remove('flash-on');
    void this.el.goalFlash.offsetWidth;
    this.el.goalFlash.classList.add('flash-on');
  }

  showEnd(winner, score) {
    const blueWin = winner === 'blue';
    this.el.endTitle.textContent = blueWin ? 'BLUE WINS' : 'RED WINS';
    this.el.endTitle.classList.toggle('red-win', !blueWin);
    this.el.endKicker.textContent = this.overtime ? 'GOLDEN GOAL' : 'FULL TIME';
    this.el.endBlue.textContent = score.blue;
    this.el.endRed.textContent = score.red;
    this.showEndScreen(true);
  }

  showEndScreen(show) {
    this.el.end.classList.toggle('hidden', !show);
  }

  drawMinimap(game) {
    const g = this.ctx;
    const w = this.el.minimap.width;
    const h = this.el.minimap.height;
    g.clearRect(0, 0, w, h);

    const pad = 14;
    const fieldW = w - pad * 2;
    const fieldH = h - pad * 2;
    const sx = fieldW / (ARENA.halfW * 2);
    const sz = fieldH / (ARENA.halfL * 2);
    const cx = w / 2;
    const cy = h / 2;

    g.fillStyle = 'rgba(4, 10, 24, 0.7)';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 12);
    g.fill();

    g.fillStyle = 'rgba(20, 72, 58, 0.55)';
    g.fillRect(cx - ARENA.halfW * sx, cy - ARENA.halfL * sz, ARENA.halfW * 2 * sx, ARENA.halfL * 2 * sz);

    g.strokeStyle = 'rgba(160, 220, 255, 0.4)';
    g.lineWidth = 1.5;
    g.strokeRect(cx - ARENA.halfW * sx, cy - ARENA.halfL * sz, ARENA.halfW * 2 * sx, ARENA.halfL * 2 * sz);

    g.beginPath();
    g.moveTo(cx - ARENA.halfW * sx, cy);
    g.lineTo(cx + ARENA.halfW * sx, cy);
    g.stroke();

    g.beginPath();
    g.arc(cx, cy, 16, 0, TAU);
    g.stroke();

    // goals
    g.fillStyle = 'rgba(61, 210, 255, 0.85)';
    g.fillRect(cx - ARENA.goalHalfW * sx, cy + ARENA.halfL * sz - 3, ARENA.goalHalfW * 2 * sx, 5);
    g.fillStyle = 'rgba(255, 64, 110, 0.85)';
    g.fillRect(cx - ARENA.goalHalfW * sx, cy - ARENA.halfL * sz - 2, ARENA.goalHalfW * 2 * sx, 5);

    // item boxes
    for (const box of game.items.boxes) {
      if (!box.active) continue;
      const x = cx + box.base.x * sx;
      const y = cy + box.base.z * sz;
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillStyle = 'rgba(255, 220, 90, 0.9)';
      g.fillRect(-2.5, -2.5, 5, 5);
      g.restore();
    }

    // bananas
    for (const b of game.items.bananas) {
      g.fillStyle = 'rgba(255, 225, 74, 0.95)';
      g.beginPath();
      g.arc(cx + b.pos.x * sx, cy + b.pos.z * sz, 2.4, 0, TAU);
      g.fill();
    }

    // ball
    const bx = cx + game.ball.pos.x * sx;
    const by = cy + game.ball.pos.z * sz;
    g.beginPath();
    g.arc(bx, by, 5, 0, TAU);
    g.fillStyle = 'rgba(255, 255, 255, 0.25)';
    g.fill();
    g.beginPath();
    g.arc(bx, by, 3, 0, TAU);
    g.fillStyle = '#ffffff';
    g.fill();

    // cars
    for (const car of game.cars) {
      const x = cx + car.pos.x * sx;
      const y = cy + car.pos.z * sz;
      const color = car.team === 'blue' ? TEAM.blue.css : TEAM.red.css;
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI - car.yaw);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4, 5);
      g.lineTo(0, 2.5);
      g.lineTo(-4, 5);
      g.closePath();
      g.fill();
      if (car.isPlayer) {
        g.strokeStyle = '#d9ff45';
        g.lineWidth = 1.8;
        g.beginPath();
        g.arc(0, 0, 8, 0, TAU);
        g.stroke();
      }
      g.restore();
    }

    g.fillStyle = 'rgba(150, 190, 230, 0.5)';
    g.font = '700 10px Chakra, sans-serif';
    g.textAlign = 'left';
    g.fillText('YOU', 10, h - 9);
    g.fillStyle = '#d9ff45';
    g.fillRect(36, h - 16, 8, 3);
  }
}
