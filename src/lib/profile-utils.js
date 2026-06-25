export const onlyDigits = (value) => String(value || '').replace(/\D/g, '')

export const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export const normalizeInstagram = (value) => {
  const clean = String(value || '').trim().replace(/^@+/, '')
  return clean ? `@${clean}` : ''
}

export const isProfileComplete = (profile) => {
  if (!profile) return false

  const hasLegacyProfileCompletion = Boolean(
    (profile.display_name || profile.full_name)
    && String(profile.instagram_handle || profile.instagram || '').trim()
    && profile.followers_count !== null
    && profile.followers_count !== undefined
  )

  const hasCurrentProfileCompletion = Boolean(
    hasLegacyProfileCompletion
    && String(profile.cpf || '').trim()
  )

  return Boolean(hasCurrentProfileCompletion || hasLegacyProfileCompletion)
}

export const extractSignupProfileFromMetadata = (metadata = {}) => {
  const displayName = String(metadata.display_name || metadata.full_name || '').trim()
  if (!displayName) return null

  const payload = {
    full_name: String(metadata.full_name || displayName).trim(),
    display_name: displayName,
  }

  const cpf = String(metadata.cpf || '').trim()
  if (cpf) payload.cpf = cpf

  const instagram = String(metadata.instagram_handle || '').trim()
  if (instagram) payload.instagram_handle = instagram

  if (metadata.bio) payload.bio = metadata.bio

  if (metadata.followers_count !== null && metadata.followers_count !== undefined && metadata.followers_count !== '') {
    const followers = Number(metadata.followers_count)
    if (!Number.isNaN(followers) && followers >= 0) {
      payload.followers_count = followers
    }
  }

  return payload
}

export const buildProfileSyncFromMetadata = (metadata = {}, profile = null) => {
  const safeProfile = profile || {}
  const signupData = extractSignupProfileFromMetadata(metadata)

  if (!signupData?.cpf || !signupData?.instagram_handle) {
    return {}
  }

  if (isProfileComplete(safeProfile)) {
    return {}
  }

  const updates = {}

  if (!String(safeProfile.display_name || '').trim()) {
    updates.display_name = signupData.display_name
  }

  if (!String(safeProfile.full_name || '').trim()) {
    updates.full_name = signupData.full_name
  }

  if (!String(safeProfile.cpf || '').trim()) {
    updates.cpf = signupData.cpf
  }

  if (!String(safeProfile.instagram_handle || safeProfile.instagram || '').trim()) {
    updates.instagram_handle = signupData.instagram_handle
  }

  if (!String(safeProfile.bio || '').trim() && signupData.bio) {
    updates.bio = signupData.bio
  }

  if (signupData.followers_count !== undefined) {
    updates.followers_count = signupData.followers_count
  }

  return updates
}

export const buildSignupProfilePayload = ({
  displayName,
  cpf,
  bio,
  instagram,
  followersCount,
}) => {
  const trimmedName = String(displayName || '').trim()
  const cpfDigits = onlyDigits(cpf)
  const normalizedInstagram = normalizeInstagram(instagram)
  const followers = Number(followersCount)

  return {
    payload: {
      full_name: trimmedName,
      display_name: trimmedName,
      cpf: formatCpf(cpfDigits),
      instagram_handle: normalizedInstagram,
      followers_count: followers,
      bio: String(bio || '').trim() || null,
      signup_profile: true,
    },
    trimmedName,
    cpfDigits,
    normalizedInstagram,
    followers,
  }
}
