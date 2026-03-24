type ChalkLike = ((...args: unknown[]) => string) & {
  [key: string]: ChalkLike;
};

function joinArgs(args: unknown[]) {
  return args.map((item) => String(item)).join(" ");
}

function createChalk(): ChalkLike {
  const base = ((...args: unknown[]) => joinArgs(args)) as ChalkLike;

  return new Proxy(base, {
    get() {
      return createChalk();
    },
    apply(_, __, args) {
      return joinArgs(args);
    },
  });
}

const chalk = createChalk();

export default chalk;
