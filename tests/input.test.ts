// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { InputController } from "../src/game/input";

describe("keyboard input focus behavior", () => {
  let controller: InputController | undefined;
  let canvas: HTMLElement | undefined;

  afterEach(() => {
    if (controller && canvas) controller.detach(canvas);
    controller = undefined;
    canvas?.remove();
    canvas = undefined;
    document.body.replaceChildren();
  });

  function attach() {
    canvas = document.createElement("div");
    document.body.append(canvas);
    controller = new InputController();
    controller.attach(canvas);
    return controller;
  }

  it("leaves Space activation on a focused button to the browser", () => {
    const input = attach();
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();

    const down = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
    window.dispatchEvent(down);

    expect(down.defaultPrevented).toBe(false);
    expect(input.consume()).toMatchObject({ boost: false, steer: 0, brake: 0, pause: false });
  });

  it("keeps pause shortcuts active while a pause button has focus", () => {
    const input = attach();
    const resume = document.createElement("button");
    document.body.append(resume);
    resume.focus();

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
    expect(input.consume().pause).toBe(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP", bubbles: true }));
    expect(input.consume().pause).toBe(true);
  });

  it("does not steer or boost while a text field or select has focus", () => {
    const input = attach();
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();

    const space = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
    window.dispatchEvent(space);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));

    expect(space.defaultPrevented).toBe(false);
    expect(input.consume()).toMatchObject({ boost: false, steer: 0, brake: 0, pause: false });

    const select = document.createElement("select");
    document.body.append(select);
    select.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));
    expect(input.consume().steer).toBe(0);
  });

  it("keeps gameplay keys active when focus is outside UI controls", () => {
    const input = attach();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
    expect(input.consume()).toMatchObject({ boost: true, steer: 1 });
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));
    expect(input.consume().steer).toBe(0);
  });
});
