export type InputState = {
  steer: number;
  brake: number;
  boost: boolean;
  pause: boolean;
};

export function keyboardSteer(left: boolean, right: boolean): number {
  return Number(left) - Number(right);
}

export function pointerSteer(originX: number, clientX: number, span: number): number {
  return Math.max(-1, Math.min(1, (originX - clientX) / Math.max(110, span)));
}

function keyboardIsInUiControl(code: string) {
  const active = document.activeElement;
  if (!(active instanceof Element)) return false;
  if ((code === "Escape" || code === "KeyP") && active.closest("button")) return false;
  return Boolean(active.closest(
    'button, input, textarea, select, a[href], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"]',
  ));
}

export class InputController {
  steer = 0;
  brake = 0;
  boostPressed = false;
  pausePressed = false;

  private keys = new Set<string>();
  private pointerId: number | null = null;
  private pointerOriginX = 0;
  private pointerSteer = 0;
  private boostHeld = false;
  private bound = false;

  attach(canvas: HTMLElement) {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  detach(canvas: HTMLElement) {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.bound = false;
  }

  setBrakeButton(down: boolean) {
    this.brake = down ? 1 : this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0;
  }

  setBoostButton(down: boolean) {
    if (down && !this.boostHeld) this.boostPressed = true;
    this.boostHeld = down;
  }

  private onBlur = () => {
    this.keys.clear();
    this.pointerId = null;
    this.pointerSteer = 0;
    this.brake = 0;
    this.boostHeld = false;
    this.boostPressed = false;
    this.pausePressed = false;
  };

  consume(): InputState {
    const state: InputState = {
      steer: this.currentSteer(),
      brake: this.brake || (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0),
      boost: this.boostPressed,
      pause: this.pausePressed,
    };
    this.boostPressed = false;
    this.pausePressed = false;
    return state;
  }

  private currentSteer() {
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    if (this.pointerId !== null) return this.pointerSteer;
    return keyboardSteer(left, right);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    // Let controls keep their native keyboard behavior (Space activates buttons,
    // arrows move carets/options, and typing never steers or boosts the car).
    if (keyboardIsInUiControl(event.code)) {
      this.keys.delete(event.code);
      return;
    }
    if (event.repeat && (event.code === "Space" || event.code === "Escape")) return;
    this.keys.add(event.code);
    if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
      event.preventDefault();
      this.boostPressed = true;
    }
    if (event.code === "Escape" || event.code === "KeyP") {
      this.pausePressed = true;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, a, .panel")) return;
    this.pointerId = event.pointerId;
    this.pointerOriginX = event.clientX;
    this.pointerSteer = 0;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return;
    const span = Math.max(110, window.innerWidth * 0.16);
    this.pointerSteer = pointerSteer(this.pointerOriginX, event.clientX, span);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    this.pointerSteer = 0;
  };
}
