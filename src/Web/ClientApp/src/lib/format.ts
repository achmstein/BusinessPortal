// Australian business identifiers have conventional groupings, and people read
// them back off screen to check against a letter from ASIC or the ATO. Grouped
// digits are meaningfully easier to verify than an 11-character run.

/** 51824753556 → "51 824 753 556" (2-3-3-3). Returns the input if it isn't 11 digits. */
export function formatAbn(abn: string | null | undefined): string {
  const digits = (abn ?? '').replace(/\D/g, '')
  if (digits.length !== 11) return abn?.trim() ?? ''
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
}

/** 004085616 → "004 085 616" (3-3-3). Returns the input if it isn't 9 digits. */
export function formatAcn(acn: string | null | undefined): string {
  const digits = (acn ?? '').replace(/\D/g, '')
  if (digits.length !== 9) return acn?.trim() ?? ''
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

/**
 * Show only the last three digits of a tax file number.
 *
 * A TFN is among the most sensitive things this portal holds, and there is no
 * reason to paint one in full on a screen someone might be sharing or standing
 * beside. The field can still be revealed deliberately.
 */
export function maskTfn(tfn: string | null | undefined): string {
  const digits = (tfn ?? '').replace(/\D/g, '')
  if (digits.length < 4) return digits ? '•••' : ''
  return `••• ••• ${digits.slice(-3)}`
}
