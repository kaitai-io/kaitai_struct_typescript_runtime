import type { KaitaiStream } from './index'
// ========================================================================
// Internal implementation details
// ========================================================================
export class EOFError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  public bytesReq: number;
  public bytesAvail: number;

  constructor(bytesReq: number, bytesAvail: number) {
    super();
    this.name = 'EOFError';
    this.message = `requested ${bytesReq} bytes, but only ${bytesAvail} bytes available`;
    this.bytesReq = bytesReq;
    this.bytesAvail = bytesAvail;
    this.stack = (new Error()).stack;
  }
}

// Unused since Kaitai Struct Compiler v0.9+ - compatibility with older versions
export class UnexpectedDataError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  private expected: Uint8Array;
  private actual: Uint8Array;

  constructor(expected: Uint8Array, actual: Uint8Array) {
    super();
    this.name = 'UnexpectedDataError';
    this.message = `expected [${expected}], but got [${actual}]`;
    this.expected = expected;
    this.actual = actual;
    this.stack = (new Error()).stack;
  }
}

export class UndecidedEndiannessError extends Error {
  public name: string;
  public stack?: string;

  constructor() {
    super();
    this.name = 'UndecidedEndiannessError';
    this.stack = (new Error()).stack;
  }
}

export class ValidationNotEqualError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  private expected: unknown;
  private actual: unknown;

  constructor(expected: unknown, actual: unknown) {
    super();
    this.name = 'ValidationNotEqualError';
    this.message = `not equal, expected [${expected}], but got [${actual}]`;
    this.expected = expected;
    this.actual = actual;
    this.stack = (new Error()).stack;
  }
}

export class ValidationLessThanError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  private min: number;
  private actual: number;

  constructor(min: number, actual: number) {
    super();
    this.name = 'ValidationLessThanError';
    this.message = `not in range, min [${min}], but got [${actual}]`;
    this.min = min;
    this.actual = actual;
    this.stack = (new Error()).stack;
  }
}

export class ValidationGreaterThanError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  private max: number;
  private actual: number;

  constructor(max: number, actual: number) {
    super();
    this.name = 'ValidationGreaterThanError';
    this.message = `not in range, max [${max}], but got [${actual}]`;
    this.max = max;
    this.actual = actual;
    this.stack = (new Error()).stack;
  }
}

export class ValidationNotAnyOfError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  private actual: unknown;

  constructor(actual: unknown, io: KaitaiStream, srcPath: string) {
    super();
    this.name = 'ValidationNotAnyOfError';
    this.message = `not any of the list, got [${actual}]`;
    this.actual = actual;
    this.stack = (new Error()).stack;
  }
}

export class ValidationExprError extends Error {
  public name: string;
  public message: string;
  public stack?: string;
  private actual: unknown;

  constructor(actual: unknown, io: KaitaiStream, srcPath: string) {
    super();
    this.name = 'ValidationExprError';
    this.message = `not matching the expression, got [${actual}]`;
    this.actual = actual;
    this.stack = (new Error()).stack;
  }
}
