export interface KycUserData {
  status: 'approved' | 'rejected' | 'pending'
  selected_country_code: string
  address_subdivision: string
  address_country_code: string
  birthdate: string
  expiration_date: string
  issue_date: string
  issuing_authority: string
}
