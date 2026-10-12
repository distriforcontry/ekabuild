/** Same keys, every leaf a string — used to type-check translations against the uz source. */
export type Shape<T> = T extends string ? string : T extends readonly (infer U)[] ? Shape<U>[] : { [K in keyof T]: Shape<T[K]> };

/** Dotted key paths of a nested messages object, e.g. "nav.home" */
export type Paths<T, P extends string = ""> = T extends string
  ? P
  : T extends readonly unknown[]
    ? P
    : { [K in keyof T & string]: Paths<T[K], P extends "" ? K : `${P}.${K}`> }[keyof T & string];
