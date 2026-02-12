export default function GeneralConsent({ isChecked, setIsChecked }) {
  const handleCheck = () => setIsChecked(!isChecked)

  return (
    <div className="flex gap-2 items-center">
      <input type="checkbox" name="consent" id="consent" checked={isChecked} onClick={handleCheck} />
      <label htmlFor="consent" className="text-default-700 text-xs">
        I have read and agree to the{" "}
        <a
          className="font-bold text-primary"
          href="https://www.instantofferspro.com/disclosure-statement-terms-of-use/"
          target="_blank"
        >
          Terms & Conditions
        </a>
      </label>
    </div>
  )
}
