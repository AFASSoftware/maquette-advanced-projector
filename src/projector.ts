import { Projection, ProjectionOptions, Projector, VNode, VNodeProperties, dom } from "maquette";

import {
  AdvancedProjectorOptions,
  AllAdvancedProjectorOptions,
  defaultAdvancedProjectorOptions,
} from "./advanced-projector-options.js";
import { applyDefaultProjectionOptions } from "./utils.js";

export type AdvancedProjector = Projector;

const createParentNodePath = (node: Node, rootNode: Element) => {
  const parentNodePath: Node[] = [];
  while (node && node !== rootNode) {
    parentNodePath.push(node);
    node = node.parentNode!;
  }
  return parentNodePath;
};

const findVNodeByParentNodePath = (vnode: VNode, parentNodePath: Node[]): VNode | undefined => {
  let result: VNode | undefined = vnode;
  parentNodePath.forEach((node) => {
    result =
      result && result.children
        ? result.children.find((child) => child.domNode === node)
        : undefined;
  });
  return result;
};

export const createAdvancedProjector = (options: AdvancedProjectorOptions): AdvancedProjector => {
  const projectorOptions: AllAdvancedProjectorOptions = {
    ...defaultAdvancedProjectorOptions,
    ...options,
  };
  const projectionOptions = applyDefaultProjectionOptions(projectorOptions);
  const performanceLogger = projectionOptions.performanceLogger!;
  let renderCompleted = true;
  let scheduled: number | undefined;
  let stopped = false;
  const projections = [] as Projection[];
  const renderFunctions = [] as (() => VNode)[]; // matches the projections array

  const addProjection = (
    /* one of: dom.append, dom.insertBefore, dom.replace, dom.merge */
    domFunction: (node: Element, vnode: VNode, projectionOptions: ProjectionOptions) => Projection,
    /* the parameter of the domFunction */
    node: Element,
    renderFunction: () => VNode
  ): void => {
    // eslint-disable-next-line prefer-const -- projection is assigned after being captured in closure
    let projection!: Projection;
    projectionOptions.eventHandlerInterceptor = (
      _propertyName: string,
      _eventHandler: (evt: Event) => boolean | void,
      _domNode: Node,
      _properties: VNodeProperties
    ) => {
      return function (this: Node, evt: Event) {
        performanceLogger("domEvent", evt);
        const parentNodePath = createParentNodePath(
          evt.currentTarget as Element,
          projection.domNode
        );
        parentNodePath.reverse();
        const matchingVNode = findVNodeByParentNodePath(projection.getLastRender(), parentNodePath);

        let result: any;
        if (matchingVNode) {
          result = projectorOptions.handleInterceptedEvent(projector, matchingVNode, this, evt);
        }
        performanceLogger("domEventProcessed", evt);
        return result;
      };
    };
    projectorOptions.postProcessProjectionOptions?.(projectionOptions);
    const firstVNode = renderFunction();
    projection = domFunction(node, firstVNode, projectionOptions);
    projectionOptions.eventHandlerInterceptor = undefined;
    projections.push(projection);
    renderFunctions.push(renderFunction);
    if (projectorOptions.afterFirstVNodeRendered) {
      projectorOptions.afterFirstVNodeRendered(projection, firstVNode);
    }
  };

  let doRender = () => {
    scheduled = undefined;
    if (!renderCompleted) {
      return; // The last render threw an error, it should have been logged in the browser console.
    }
    renderCompleted = false;
    performanceLogger("renderStart", undefined);
    for (let i = 0; i < projections.length; i++) {
      const updatedVnode = renderFunctions[i]();
      performanceLogger("rendered", undefined);
      projections[i].update(updatedVnode);
      performanceLogger("patched", undefined);
    }
    performanceLogger("renderDone", undefined);
    renderCompleted = true;
  };

  if (projectorOptions.modifyDoRenderImplementation) {
    doRender = projectorOptions.modifyDoRenderImplementation(
      doRender,
      projections,
      renderFunctions
    );
  }

  const projector: Projector = {
    renderNow: doRender,
    scheduleRender: () => {
      if (!scheduled && !stopped) {
        scheduled = requestAnimationFrame(doRender);
      }
    },
    stop: () => {
      if (scheduled) {
        cancelAnimationFrame(scheduled);
        scheduled = undefined;
      }
      stopped = true;
    },

    resume: () => {
      stopped = false;
      renderCompleted = true;
      projector.scheduleRender();
    },

    append: (parentNode, renderFunction) => {
      addProjection(dom.append, parentNode, renderFunction);
    },

    insertBefore: (beforeNode, renderFunction) => {
      addProjection(dom.insertBefore, beforeNode, renderFunction);
    },

    merge: (domNode, renderFunction) => {
      addProjection(dom.merge, domNode, renderFunction);
    },

    replace: (domNode, renderFunction) => {
      addProjection(dom.replace, domNode, renderFunction);
    },

    detach: (renderFunction) => {
      for (let i = 0; i < renderFunctions.length; i++) {
        if (renderFunctions[i] === renderFunction) {
          renderFunctions.splice(i, 1);
          return projections.splice(i, 1)[0];
        }
      }
      throw new Error("renderFunction was not found");
    },
  };
  return projector;
};
