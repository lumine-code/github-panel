/** @babel */
export const COMMENT_LIMIT = 65536;
export const FIELD_LIMIT = 4096;
export const PATH_LIMIT = 32768;

export function fitsInput(buffer, limit) {
  return buffer.getLength() <= limit;
}

export function inputError(buffer, limit, label) {
  return fitsInput(buffer, limit)
    ? null
    : {
        message: `${label} exceeds the ${limit.toLocaleString()} character input limit. Shorten the text to continue.`,
      };
}
