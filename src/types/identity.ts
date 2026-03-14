type DateString = `${number}${number}${number}${number}-${number}${number}-${number}${number}`

export interface KycUserData {
  status: string
  selected_country_code: string
  address_subdivision: string
  address_country_code: string
  birthdate: DateString
  expiration_date: DateString
  issue_date: DateString
  issuing_authority: string
}
