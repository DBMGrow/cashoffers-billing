export default function InvestorConsent({ data, isChecked, setIsChecked }) {
  const handleCheck = () => setIsChecked(!isChecked)

  const isInvestor = data.product == "11" || data.product == "freeinvestor"
  if (!isInvestor) return null

  return (
    <div className="flex gap-2 items-center">
      <input type="checkbox" name="consentinvestor" id="consentinvestor" checked={isChecked} onClick={handleCheck} />
      <label htmlFor="consentinvestor" className="text-caption">
        I have read and agree to the{" "}
        <a
          className="font-bold"
          href="https://www.instantofferspro.com/investors/services-and-fee-agreement/"
          target="_blank"
        >
          Investor Disclosure
        </a>
      </label>
    </div>
  )
}
