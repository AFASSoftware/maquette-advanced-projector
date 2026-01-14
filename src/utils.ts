import { ProjectionOptions } from "maquette";

const DEFAULT_PROJECTION_OPTIONS: ProjectionOptions = {
  namespace: undefined,
  performanceLogger: () => undefined,
  eventHandlerInterceptor: undefined,
  styleApplyer: (domNode: HTMLElement, styleName: string, value: string) => {
    if (styleName.charAt(0) === "-") {
      // CSS variables must be set using setProperty
      domNode.style.setProperty(styleName, value);
    } else {
      // properties like 'backgroundColor' must be set as a js-property
      (domNode.style as any)[styleName] = value;
    }
  },
};

export const applyDefaultProjectionOptions = (
  projectorOptions?: ProjectionOptions
): ProjectionOptions => {
  return { ...DEFAULT_PROJECTION_OPTIONS, ...projectorOptions };
};
