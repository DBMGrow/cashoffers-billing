import {
  Modal as NextUIModal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalFooter,
  useDisclosure,
} from "@nextui-org/react"
import { useEffect } from "react"

export default function Modal({ isOpen, setIsOpen, title, children }) {
  const { isOpen: isOpenDisclosure, onOpen, onClose } = useDisclosure()

  useEffect(() => {
    if (isOpen) {
      onOpen()
    } else {
      onClose()
    }
  }, [isOpen, onOpen, onClose])

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  return (
    <NextUIModal isOpen={isOpenDisclosure} onClose={handleClose}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
        <ModalFooter>
          <button className="btn btn-primary" onClick={handleClose}>
            Close
          </button>
        </ModalFooter>
      </ModalContent>
    </NextUIModal>
  )
}
