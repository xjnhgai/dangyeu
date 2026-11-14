/** Keep numeric list entries and separators, including pasted multiline input. */
export function cleanListingInput(value: string): string {
  // Some numeric keyboards expose a decimal dot instead of a comma.
  return value.replace(/\./g, ',').replace(/[^0-9,\s]/g, '')
}
