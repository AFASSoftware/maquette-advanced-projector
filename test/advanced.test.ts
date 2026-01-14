import { VNode, h } from "maquette";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvancedProjector, createAdvancedProjector } from "../src/index.js";

describe("advanced projector", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(5));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("can choose not to schedule render automatically from an event handler", () => {
    const advancedProjector = createAdvancedProjector({
      handleInterceptedEvent: (
        _projector: AdvancedProjector,
        vNode: VNode,
        _node: Node,
        evt: Event
      ) => {
        // simplest implementation ignoring return value
        vNode.properties![`on${evt.type}`](evt);
      },
    });

    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    const handleClick = vi.fn();
    const renderFunction = () => h("button", { onclick: handleClick });
    advancedProjector.append(parentElement as any, renderFunction);

    const button = parentElement.appendChild.mock.calls[0][0] as HTMLElement;
    const clickEvent = {
      currentTarget: button,
      type: "click",
    } as object as MouseEvent;

    button.onclick!.apply(button, [clickEvent]);
    expect(handleClick).toHaveBeenCalledWith(clickEvent);

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("can replace the internal render function", () => {
    const afterFirstVNodeRendered = vi.fn();
    let doRenderSpy: ReturnType<typeof vi.fn>;
    const advancedProjector = createAdvancedProjector({
      afterFirstVNodeRendered,
      modifyDoRenderImplementation: (doRender: () => void) => {
        doRenderSpy = vi.fn(doRender);
        return doRenderSpy;
      },
    });
    const renderFunction = () => h("div");
    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    advancedProjector.append(parentElement as any, renderFunction);
    expect(afterFirstVNodeRendered).toHaveBeenCalledOnce();
    advancedProjector.scheduleRender();
    const render = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    expect(doRenderSpy!).not.toHaveBeenCalled();
    render(0);
    expect(doRenderSpy!).toHaveBeenCalledOnce();
  });

  it("can post-process projection options", () => {
    const postProcessProjectionOptions = vi.fn();
    const advancedProjector = createAdvancedProjector({
      postProcessProjectionOptions,
    });
    const renderFunction = () => h("div");
    const parentElement = { appendChild: vi.fn(), ownerDocument: document };
    advancedProjector.append(parentElement as any, renderFunction);
    expect(postProcessProjectionOptions).toHaveBeenCalledOnce();
  });
});
