import { owner, asUser } from '../db.js'

export interface Me {
  user: { id: string; email: string }
  profile: {
    id: string
    username: string
    display_name: string | null
    org_id: string
    role: string
    job_title: string | null
    date_of_birth: string | null
    address: string | null
  } | null
  organisation: { id: string; name: string } | null
  isPlatformAdmin: boolean
}

export const PROFILE_COLUMNS =
  "id, username, display_name, org_id, role, job_title, to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth, address"

/** Everything the frontend's AuthContext needs about the signed-in user. */
export async function loadMe(userId: string): Promise<Me | null> {
  const { rows: [user] } = await owner.query<{ id: string; email: string }>(
    'select id, email from auth.users where id = $1', [userId])
  if (!user) return null
  return asUser(userId, async db => {
    const { rows: [profile] } = await db.query(`select ${PROFILE_COLUMNS} from public.profiles where id = $1`, [userId])
    const { rows: [organisation] } = profile?.org_id
      ? await db.query('select id, name from public.organisations where id = $1', [profile.org_id])
      : { rows: [] }
    const { rows: [admin] } = await db.query<{ is: boolean }>('select public.is_platform_admin() as is')
    return {
      user: { id: user.id, email: user.email },
      profile: profile ?? null,
      organisation: organisation ?? null,
      isPlatformAdmin: admin?.is === true,
    }
  })
}
