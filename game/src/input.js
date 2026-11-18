// Solmar Bay — Neon Tide: keyboard and mouse input.
// Tracks held keys by KeyboardEvent.code, edge-triggered presses for menu keys,
// and mouse-drag deltas for orbiting the third-person camera.

export class Input {
  constructor(target) {
    this.target = target;
    this.keys = new Set(); // currently held codes
    this.pressed = new Set(); // codes pressed since the last frame's read
    this.mouseDX = 0; // accumulated drag delta x since last read
    this.mouseDY = 0; // accumulated drag delta y since last read
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.enabled = true;
    this._onKeyDown = (event) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onMouseDown = (event) => {
      if (!this.enabled) return;
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    };
    this._onMouseMove = (event) => {
      if (!this.dragging || !this.enabled) return;
      this.mouseDX += event.clientX - this.lastX;
      this.mouseDY += event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    };
    this._onMouseUp = () => {
      this.dragging = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.pressed.clear();
      this.dragging = false;
    };
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousedown', this._onMouseDown);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('mouseup', this._onMouseUp);
    target.addEventListener('blur', this._onBlur);
  }

  // True while the key is held down.
  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down. Consume it so a held key does
  // not retrigger menu actions every frame.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Movement axes from WASD or arrow keys: x is strafe, y is forward.
  axes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  // Take the accumulated mouse drag since the last call and reset it.
  takeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  // Call at the end of each frame: presses not consumed this frame expire.
  endFrame() {
    this.pressed.clear();
  }

  dispose() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('mousedown', this._onMouseDown);
    this.target.removeEventListener('mousemove', this._onMouseMove);
    this.target.removeEventListener('mouseup', this._onMouseUp);
    this.target.removeEventListener('blur', this._onBlur);
  }
}
