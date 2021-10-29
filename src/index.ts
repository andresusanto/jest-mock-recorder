import fs from "fs-extra";
import path from "path";

interface IPrototype<T> {
  prototype: T;
}

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T] &
  string;

/**
 * Options to be used by the mock recorder
 */
export interface MockRecorderOptions {
  /** Unit test name. Useful to resolve mock conflict */
  unitTestName?: string;
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
>(mockedClass: IPrototype<T>, mockedMethod: M, opts?: MockRecorderOptions) {
  const options = Object.assign({ unitTestName: "__default__" }, opts);
  const className = `${mockedClass.prototype.constructor.name}.${mockedMethod}`;
  const originalMethod = mockedClass.prototype[mockedMethod];
  if (typeof originalMethod !== "function")
    throw new Error(`Method ${className} not found`);

  const fileName = path.join(
    process.cwd(),
    "__tests__",
    "_fixtures",
    options.unitTestName,
    `${className}.json`
  );
  fs.ensureFileSync(fileName);
  const recording = JSON.parse(
    fs.readFileSync(fileName).toString("utf8") || "{}"
  );

  jest
    .spyOn(mockedClass.prototype, mockedMethod)
    .mockImplementation(function (this: T, ...args) {
      const serilizedArgs = JSON.stringify(args);
      let res = recording[serilizedArgs];
      if (!res && process.env["MOCK_RECORDER"] !== "record")
        throw new Error(
          `MOCK_RECORDER is not set to "record" but no recording found for ${className} with args ${serilizedArgs}.`
        );

      if (!res) {
        console.warn(
          `No recording found for ${className} with args ${serilizedArgs}. Recording...`
        );
        res = originalMethod.apply(this, args);

        if (typeof res.then === "function") {
          return Promise.resolve(res).then((r) => {
            recording[serilizedArgs] = r;
            fs.writeFileSync(fileName, JSON.stringify(recording, null, 2));
            return r;
          });
        }

        recording[serilizedArgs] = res;
        fs.writeFileSync(fileName, JSON.stringify(recording, null, 2));
        console.warn(
          `Recording done and saved for ${className} with args ${serilizedArgs}.`
        );
      }
      return res;
    });
}
