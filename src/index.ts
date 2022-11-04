import fs from "fs-extra";
import path from "path";

interface IPrototype<T> {
  prototype: T;
}

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T] &
  string;

export type Serializer<T> = (input: T) => string | Promise<string>;
export type Deserializer<T> = (input: string) => T;
export type SerDe<T> = {
  serializer: Serializer<T>;
  deserializer: Deserializer<T>;
};

function printArgs(arg: string): string {
  if (arg.length > 20) {
    return arg.substring(0, 20) + "...";
  }
  return arg;
}

/**
 * Options to be used by the mock recorder
 */
export interface MockRecorderOptions<T, I> {
  /** Unit test name. Useful to resolve mock conflict */
  unitTestName?: string;

  /** Unit test folder. Defaults to __test__. If set to `null`, no folder will be used. */
  unitTestFolder?: string | null;

  /** Recorded fixture folder. Defaults to _fixtures. If set to `null`, no folder will be used. */
  fixtureFolder?: string | null;

  /** Serializer and Deserializer for the mocked function */
  serDe?: SerDe<T>;

  /** Serializer used to serialize the input arguments */
  argsSerializer?: (args: I) => string;
}

function getFileName<T, I>(
  opts: MockRecorderOptions<T, I> | undefined,
  mockName: string
) {
  return path.join(
    process.cwd(),
    ...(opts?.unitTestFolder !== null
      ? [opts?.unitTestFolder ?? "__tests__"]
      : []),
    ...(opts?.fixtureFolder !== null
      ? [opts?.fixtureFolder ?? "_fixtures"]
      : []),
    opts?.unitTestName ?? "__default__",
    `${mockName}.json`
  );
}

function createMock<T, M extends Function>(
  fileName: string,
  mockName: string,
  originalFn: M,
  opts:
    | (M extends (...args: any) => any
        ? MockRecorderOptions<ReturnType<M>, Parameters<M>>
        : never)
    | undefined
) {
  const serializer =
    opts?.serDe?.serializer || ((x: any) => JSON.stringify(x, null, 2));
  const deserializer = opts?.serDe?.deserializer || JSON.parse;

  fs.ensureFileSync(fileName);
  const recording: Record<string, string> = JSON.parse(
    fs.readFileSync(fileName).toString("utf8") || "{}"
  );

  return function mockImplementation(this: T, ...args: any) {
    const serilizedArgs =
      (opts?.argsSerializer && opts?.argsSerializer(args)) ??
      JSON.stringify(args);
    let res =
      recording[serilizedArgs] && deserializer(recording[serilizedArgs]);
    if (!res && process.env["MOCK_RECORDER"] !== "record")
      throw new Error(
        `MOCK_RECORDER is not set to "record" but no recording found for ${mockName} with args ${printArgs(
          serilizedArgs
        )}.`
      );

    if (!res) {
      console.warn(
        `No recording found for ${mockName} with args ${printArgs(
          serilizedArgs
        )}. Recording...`
      );
      res = originalFn.apply(this, args);

      if (typeof res.then === "function") {
        return Promise.resolve(res).then(async (r) => {
          recording[serilizedArgs] = await serializer(r);
          fs.writeFileSync(fileName, JSON.stringify(recording, null, 2));
          console.warn(
            `Recording done and saved for ${mockName} with args ${printArgs(
              serilizedArgs
            )}.`
          );
          return r;
        });
      }

      const serialized = serializer(res);
      if (typeof serialized !== "string")
        throw new Error(
          "Promise based serializer only supported when the original function returned Promise."
        );

      recording[serilizedArgs] = serialized;
      fs.writeFileSync(fileName, JSON.stringify(recording, null, 2));
      console.warn(
        `Recording done and saved for ${mockName} with args ${printArgs(
          serilizedArgs
        )}.`
      );
    }
    return res;
  };
}

/**
 * Record the output of a class method, save them, and re-use the recorded output
 * for future tests.
 *
 * @param mockedClass The target class
 * @param mockedMethod The method to mock and record
 * @param opts Options to be used by the mock recorder
 */
export function mockClass<
  T extends {},
  M extends FunctionPropertyNames<Required<T>>
>(
  mockedClass: IPrototype<T>,
  mockedMethod: M,
  opts?: T[M] extends (...args: any) => any
    ? MockRecorderOptions<ReturnType<T[M]>, Parameters<T[M]>>
    : never
) {
  const mockName = `${mockedClass.prototype.constructor.name}.${mockedMethod}`;
  const originalMethod = mockedClass.prototype[mockedMethod];
  if (typeof originalMethod !== "function")
    throw new Error(`Method ${mockName} not found`);

  const mock = jest
    .spyOn(mockedClass.prototype, mockedMethod)
    .mockImplementation(
      createMock(getFileName(opts, mockName), mockName, originalMethod, opts)
    );

  return () => {
    mock.mockRestore();
  };
}

/**
 * Record the output of a method from object property, save them, and re-use the recorded output
 * for future tests.
 *
 * @param mockedObject The target object
 * @param mockedMethod The method to mock and record
 * @param opts Options to be used by the mock recorder
 */
export function mockObject<
  T extends {},
  M extends FunctionPropertyNames<Required<T>>
>(
  mockedObject: T,
  mockedMethod: M,
  opts?: T[M] extends (...args: any) => any
    ? MockRecorderOptions<ReturnType<T[M]>, Parameters<T[M]>>
    : never
) {
  const mockName = `${mockedObject.constructor.name}.${mockedMethod}`;
  const originalMethod = mockedObject[mockedMethod];
  if (typeof originalMethod !== "function")
    throw new Error(`Method ${mockName} not found`);

  const mock = jest
    .spyOn(mockedObject, mockedMethod)
    .mockImplementation(
      createMock(getFileName(opts, mockName), mockName, originalMethod, opts)
    );

  return () => {
    mock.mockRestore();
  };
}
