"use client"

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react"
import { Fragment, useState } from "react"

// useDisclosure hook for compatibility with NextUI API
export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return {
    isOpen,
    onOpen: () => setIsOpen(true),
    onClose: () => setIsOpen(false),
    onToggle: () => setIsOpen((prev) => !prev),
  }
}

// Modal wrapper component
export default function Modal({ isOpen, setIsOpen, title, children }) {
  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={handleClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        </TransitionChild>

        {/* Full-screen container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="mx-auto max-w-lg w-full bg-white rounded-lg shadow-xl">
              <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalBody>{children}</ModalBody>
                <ModalFooter>
                  <button
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:brightness-110 transition-all"
                    onClick={handleClose}
                  >
                    Close
                  </button>
                </ModalFooter>
              </ModalContent>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}

// Sub-components for structured modal content
export function ModalContent({ children }) {
  return <div className="flex flex-col">{children}</div>
}

export function ModalHeader({ children }) {
  return (
    <DialogTitle className="text-xl font-semibold p-6 pb-2 border-b border-default-200">
      {children}
    </DialogTitle>
  )
}

export function ModalBody({ children }) {
  return <div className="p-6 py-4">{children}</div>
}

export function ModalFooter({ children }) {
  return <div className="p-6 pt-2 border-t border-default-200 flex justify-end gap-2">{children}</div>
}
