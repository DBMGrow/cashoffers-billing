import Modal from "@/components/Theme/Modal"
import { useState } from "react"
import P from "@/components/Theme/P"

export default function CommunicationConsent({ isChecked, setIsChecked }: any) {
  const handleCheck = () => setIsChecked(!isChecked)
  const [isOpen, setIsOpen] = useState(false)
  const handleOpen = () => setIsOpen(true)

  return (
    <div className="flex gap-2 items-center">
      <input
        type="checkbox"
        name="consent"
        id="consent"
        checked={isChecked}
        onClick={handleCheck}
        onChange={() => {}}
      />
      <label htmlFor="consent" className="text-caption">
        I have read and agree to the{" "}
        <button className="font-bold text-primary-color" onClick={handleOpen}>
          Consent to Communication
        </button>
      </label>

      <Modal isOpen={isOpen} setIsOpen={setIsOpen} title="Consent to Communication">
        <P>
          By submitting your information through this Website, you expressly consent to receive communications from
          CashOffers.PRO, its affiliates, and service providers, including emails, phone calls, and text messages (SMS),
          even if your phone number is listed on a federal, state, or corporate Do Not Call (DNC) registry.
        </P>
        <P>
          These communications may include, but are not limited to, updates about your inquiries, information about real
          estate services, marketing offers, and other information related to the services provided through the Website.
        </P>
        <P>You acknowledge that:</P>
        <P>
          <strong>Email Communications:</strong> By providing your email address, you consent to receive emails from us
          regarding services, promotions, and updates. You can opt out of these emails at any time by following the
          unsubscribe instructions provided in the email.
        </P>
        <P>
          <strong>Phone and SMS Communications:</strong> By providing your phone number, you consent to receive phone
          calls and text messages (including by automatic dialing systems) from us or our affiliates regarding your
          inquiries and related services. Message and data rates may apply. You may opt out of receiving text messages
          at any time by replying “STOP” to any text message you receive from us.
        </P>
      </Modal>
    </div>
  )
}
