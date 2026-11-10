import bcrypt from 'bcryptjs'

// bcrypt, as Supabase used: accounts imported from Supabase keep their
// existing $2a$ hashes and passwords.

const COST = 12
export const MIN_PASSWORD_LENGTH = 8
/** bcrypt ignores everything after 72 bytes. */
export const MAX_PASSWORD_BYTES = 72

/** Compared against when the account doesn't exist, so a missing account
 *  takes as long to reject as a wrong password. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST)

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`
  }
  return null
}

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, COST)

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH)
  return ok && !!hash
}
