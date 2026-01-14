import { Projection, ProjectionOptions, ProjectorOptions, VNode } from "maquette";

import type { AdvancedProjector } from "./projector.js";

export interface AllAdvancedProjectorOptions extends ProjectorOptions {
  /**
   * Allows changing the default way maquette intercepts events.
   * The default implementation calls `scheduleRender` and then invokes
   * ```vNode.properties![`on${evt.type}`](evt);```
   */
  handleInterceptedEvent(
    projector: AdvancedProjector,
    matchingVNode: VNode,
    node: Node,
    evt: Event
  ): boolean | unknown;

  /**
   * Allows making advanced changes to ProjectionOptions that are being used.
   * @param projectionOptions The projectionOptions that may be modified.
   */
  postProcessProjectionOptions?(projectionOptions: ProjectionOptions): void;

  /**
   * Allows switching to a different lifecycle implementation (replaces the very engine of maquette)
   * @param doRender The original implementation
   * @param projections The list of projections that will be populated later.
   * @param renderFunctions The list of renderFunctions that will be populated later. Indices match with the projections array.
   */
  modifyDoRenderImplementation?(
    doRender: () => void,
    projections: Projection[],
    renderFunctions: (() => VNode)[]
  ): () => void;

  /**
   * Allows executing code for the vnode that was rendered when the projection was first created. (useful combined with modifyDoRenderImplementation)
   */
  afterFirstVNodeRendered?(projection: Projection, firstVNode: VNode): void;
}

export type AdvancedProjectorOptions = Partial<AllAdvancedProjectorOptions>;

export const defaultAdvancedProjectorOptions: AllAdvancedProjectorOptions = {
  handleInterceptedEvent: (projector: AdvancedProjector, vNode: VNode, node: Node, evt: Event) => {
    projector.scheduleRender();
    return vNode.properties![`on${evt.type}`].apply(vNode.properties!.bind || node, [evt]);
  },
};
