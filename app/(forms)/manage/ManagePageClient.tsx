"use client"

import ManageFlow from "@/components/forms/manage/ManageFlow"
import DefaultLogo from "@/components/Theme/Logo"

export default function ManagePageClient() {
  return (
    <>
      <DefaultLogo isLight={false} />
      <ManageFlow />
    </>
  )
}
