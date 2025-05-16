declare module '*.svg' {
  import type { FunctionComponent, SVGProps } from 'react';

  export const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;
}
