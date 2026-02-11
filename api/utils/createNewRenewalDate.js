export default function createNewRenewalDate(subscription) {
  const { duration, renewal_date } = subscription.dataValues
  const newRenewalDate = new Date(renewal_date)

  // duration is daily, weekly, monthly, or yearly
  switch (duration) {
    case "daily":
      newRenewalDate.setDate(newRenewalDate.getDate() + 1)
      break
    case "weekly":
      newRenewalDate.setDate(newRenewalDate.getDate() + 7)
      break
    case "monthly":
      newRenewalDate.setMonth(newRenewalDate.getMonth() + 1)
      break
    case "yearly":
      newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1)
      break
    default:
      throw new Error("Invalid duration")
  }

  return newRenewalDate
}
