import { MaquetteComponent, Projector, h } from "maquette";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdvancedProjector } from "../src/index.js";

describe("Original projector functionality", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(5));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the virtual DOM immediately when adding renderFunctions", () => {
    const parentElement = {
      appendChild: vi.fn(),
      insertBefore: vi.fn(),
      ownerDocument: {
        createElement: vi.fn((tag: string) => {
          return document.createElement(tag);
        }),
      },
      removeChild: vi.fn(),
    };
    const renderFunction = vi.fn().mockReturnValue(h("div", [h("span")]));
    const projector = createAdvancedProjector({});

    // Append
    projector.append(parentElement as any, renderFunction);

    expect(renderFunction).toHaveBeenCalledOnce();
    expect(parentElement.ownerDocument.createElement).toHaveBeenCalledOnce();
    expect(parentElement.appendChild).toHaveBeenCalledOnce();
    expect(parentElement.appendChild.mock.calls[0][0].tagName).toBe("DIV");

    // InsertBefore
    const siblingElement = {
      parentNode: parentElement,
    };

    projector.insertBefore(siblingElement as any, renderFunction);

    expect(renderFunction).toHaveBeenCalledTimes(2);
    expect(parentElement.insertBefore).toHaveBeenCalledOnce();
    expect(parentElement.insertBefore.mock.calls[0][0].tagName).toBe("DIV");
    expect(parentElement.insertBefore.mock.calls[0][1]).toBe(siblingElement);

    // Merge
    const cleanRenderFunction = vi.fn().mockReturnValue(h("div", [h("span")]));

    const existingElement = {
      appendChild: vi.fn(),
      ownerDocument: {
        createElement: vi.fn((tag: string) => {
          return document.createElement(tag);
        }),
      },
    };

    projector.merge(existingElement as any, cleanRenderFunction);

    expect(cleanRenderFunction).toHaveBeenCalledOnce();
    expect(existingElement.ownerDocument.createElement).toHaveBeenCalledOnce();
    expect(existingElement.appendChild).toHaveBeenCalledOnce();
    expect(existingElement.appendChild.mock.calls[0][0].tagName).toBe("SPAN");

    // Replace
    const oldElement = {
      parentNode: parentElement,
    };

    projector.replace(oldElement as any, renderFunction);

    expect(renderFunction).toHaveBeenCalledTimes(3);
    expect(parentElement.removeChild).toHaveBeenCalledOnce();
    expect(parentElement.removeChild.mock.calls[0][0]).toBe(oldElement);
    expect(parentElement.insertBefore).toHaveBeenCalledTimes(2);
    expect(parentElement.insertBefore.mock.calls[1][0].tagName).toBe("DIV");
    expect(parentElement.insertBefore.mock.calls[1][1]).toBe(oldElement);

    // ScheduleRender
    projector.scheduleRender();
    expect(renderFunction).toHaveBeenCalledTimes(3);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    const rafCallback = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    rafCallback(0);
    expect(renderFunction).toHaveBeenCalledTimes(6);
  });

  it("Can stop and resume", () => {
    const projector = createAdvancedProjector({});
    projector.scheduleRender();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    const rafCallback = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    rafCallback(0);

    // Stop
    projector.stop();
    projector.scheduleRender();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    // Resume
    projector.resume();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    const rafCallback2 = vi.mocked(requestAnimationFrame).mock.calls[1][0];
    rafCallback2(0);

    // Stopping before rendering
    projector.scheduleRender();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
    projector.stop();
    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
  });

  it("Stops when an error during rendering is encountered", () => {
    const projector = createAdvancedProjector({});
    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    const renderFunction = vi.fn().mockReturnValue(h("div"));
    projector.append(parentElement as any, renderFunction);
    renderFunction.mockImplementation(() => {
      throw new Error("Rendering error");
    });
    projector.scheduleRender();
    expect(() => {
      const rafCallback = vi.mocked(requestAnimationFrame).mock.calls[0][0];
      rafCallback(0);
    }).toThrow();

    const rafCallback = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    rafCallback(0);

    renderFunction.mockClear();
    projector.scheduleRender();
    const rafCallback2 = vi.mocked(requestAnimationFrame).mock.calls[1][0];
    rafCallback2(0);
    expect(renderFunction).not.toHaveBeenCalled();

    vi.mocked(requestAnimationFrame).mockClear();
    renderFunction.mockReturnValue(h("div"));
    projector.resume();
    const rafCallback3 = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    rafCallback3(0);
    expect(renderFunction).toHaveBeenCalledOnce();
  });

  it("schedules a render when event handlers are called", () => {
    const projector = createAdvancedProjector({});
    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    const handleClick = vi.fn();
    const renderFunction = () => h("button", { onclick: handleClick });
    projector.append(parentElement as any, renderFunction);

    const button = parentElement.appendChild.mock.calls[0][0] as HTMLElement;
    const evt = { currentTarget: button, type: "click" } as object as MouseEvent;

    expect(requestAnimationFrame).not.toHaveBeenCalled();

    button.onclick!.apply(button, [evt]);

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(handleClick).toHaveBeenCalledWith(evt);
  });

  it('invokes the eventHandler with "this" set to the DOM node when no bind is present', () => {
    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    const projector = createAdvancedProjector({});
    const handleClick = vi.fn();
    const renderFunction = () => h("button", { onclick: handleClick });
    projector.append(parentElement as any, renderFunction);

    const button = parentElement.appendChild.mock.calls[0][0] as HTMLElement;
    const clickEvent = { currentTarget: button, type: "click" };
    button.onclick!(clickEvent as any);

    expect(handleClick).toHaveBeenCalledWith(clickEvent);
  });

  describe("Event handlers", () => {
    /**
     * A class/prototype based implementation of a Component
     *
     * NOTE: This is not our recommended way, but this is completely supported (using VNodeProperties.bind).
     */
    class ButtonComponent implements MaquetteComponent {
      private text: string;
      private clicked: (sender: ButtonComponent) => void;

      constructor(buttonText: string, buttonClicked: (sender: ButtonComponent) => void) {
        this.text = buttonText;
        this.clicked = buttonClicked;
      }

      public render() {
        return h("button", { onclick: this.handleClick, bind: this }, [this.text]);
      }

      private handleClick(_evt: MouseEvent) {
        this.clicked(this);
      }
    }

    it('invokes the eventHandler with "this" set to the value of the bind property', () => {
      const clicked = vi.fn();
      const button = new ButtonComponent("Click me", clicked);

      const parentElement = {
        appendChild: vi.fn(),
        ownerDocument: document,
      };
      const projector = createAdvancedProjector({});
      projector.append(parentElement as any, () => button.render());

      const buttonElement = parentElement.appendChild.mock.calls[0][0] as HTMLElement;
      const clickEvent = { currentTarget: buttonElement, type: "click" };
      buttonElement.onclick!(clickEvent as any);

      expect(clicked).toHaveBeenCalledWith(button);
    });

    const allowsForEventHandlersToBeChanged = (createProjectorImpl: (arg: any) => Projector) => {
      const projector = createProjectorImpl({});
      const parentElement = {
        appendChild: vi.fn(),
        ownerDocument: document,
      };
      let eventHandler = vi.fn();

      const renderFunction = () =>
        h("div", [
          h("span", [
            h("button", {
              onclick: eventHandler,
            }),
          ]),
        ]);

      projector.append(parentElement as any, renderFunction);

      const div = parentElement.appendChild.mock.calls[0][0] as HTMLElement;
      const btn = div.firstChild!.firstChild as HTMLElement;
      const evt = {
        currentTarget: btn,
        type: "click",
      } as object as MouseEvent;

      expect(eventHandler).not.toHaveBeenCalled();
      btn.onclick!.apply(btn, [evt]);
      expect(eventHandler).toHaveBeenCalledOnce();

      // Simulate changing the event handler
      eventHandler = vi.fn();
      projector.renderNow();

      btn.onclick!.apply(btn, [evt]);
      expect(eventHandler).toHaveBeenCalledOnce();
    };

    it("allows for eventHandlers to be changed", () =>
      allowsForEventHandlersToBeChanged(createAdvancedProjector));

    it("will not call event handlers on domNodes which are no longer part of the rendered VNode", () => {
      let buttonVisible = true;
      const buttonBlur = vi.fn();
      const eventHandler = () => {
        buttonVisible = false;
      };
      const renderFunction = () =>
        h("div", [
          buttonVisible
            ? [
                h("button", {
                  onblur: buttonBlur,
                  onclick: eventHandler,
                }),
              ]
            : [],
        ]);

      const projector = createAdvancedProjector({});
      const parentElement = document.createElement("section");
      projector.append(parentElement, renderFunction);
      const div = parentElement.firstChild as HTMLElement;
      const btn = div.firstChild as HTMLButtonElement;
      btn.onclick!({ currentTarget: btn, type: "click" } as any);
      expect(buttonVisible).toBe(false);
      projector.renderNow();
      // In reality, during renderNow(), the blur event fires just before its parentNode is cleared.
      // To simulate this we recreate that state in a new button object.
      const buttonBeforeBeingDetached = {
        onblur: btn.onblur as EventListener,
        parentNode: div,
      };
      buttonBeforeBeingDetached.onblur({
        currentTarget: buttonBeforeBeingDetached,
        type: "blur",
      } as any);
      expect(buttonBlur).not.toHaveBeenCalled();
    });
  });

  it("can detach a projection", () => {
    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    const projector = createAdvancedProjector({});
    const renderFunction = () => h("textarea#t1");
    const renderFunction2 = () => h("textarea#t2");
    projector.append(parentElement as any, renderFunction);
    projector.append(parentElement as any, renderFunction2);

    const projection = projector.detach(renderFunction);
    expect(projection.domNode.id).toBe("t1");

    expect(() => {
      projector.detach(renderFunction);
    }).toThrow();
  });
});
